import * as vscode from 'vscode';

export interface TaintedVariable {
    name: string;
    line: number;
    source: 'user-input' | 'external' | 'file' | 'network';
    flows: DataFlow[];
}

export interface DataFlow {
    line: number;
    operation: 'assignment' | 'function-call' | 'concatenation' | 'interpolation';
    sink?: 'sql' | 'command' | 'eval' | 'file' | 'network';
}

export interface TaintVulnerability {
    variable: string;
    source: string;
    sink: string;
    flow: DataFlow[];
    severity: 'critical' | 'high' | 'medium';
    message: string;
}

/**
 * Basic taint tracking for data flow analysis
 * Tracks user input through the codebase to dangerous sinks
 */
export class TaintAnalyzer {
    private taintedVars: Map<string, TaintedVariable> = new Map();
    
    // User input sources
    private readonly INPUT_SOURCES = [
        // JavaScript/Node.js
        /(?:req|request)\.\s*(?:body|query|params|headers|cookies)/gi,
        /process\.argv/gi,
        /document\.(?:getElementById|querySelector|getElementsBy)/gi,
        /(?:prompt|confirm|alert)\s*\(/gi,
        /window\.location/gi,
        // Python
        /input\s*\(/gi,
        /sys\.argv/gi,
        /request\.(?:args|form|json|data|files)/gi,
        /os\.environ/gi,
        // General
        /\$_(GET|POST|REQUEST|COOKIE|SERVER)/gi
    ];

    // Dangerous sinks
    private readonly DANGEROUS_SINKS = {
        sql: [
            /execute\s*\(/gi,
            /query\s*\(/gi,
            /raw\s*\(/gi
        ],
        command: [
            /exec\s*\(/gi,
            /system\s*\(/gi,
            /spawn\s*\(/gi,
            /popen\s*\(/gi,
            /Runtime\.getRuntime\(\)\.exec/gi
        ],
        eval: [
            /eval\s*\(/gi,
            /Function\s*\(/gi,
            /setTimeout\s*\(/gi,
            /setInterval\s*\(/gi
        ],
        file: [
            /(?:readFile|writeFile|open|fopen)\s*\(/gi,
            /require\s*\(/gi,
            /import\s*\(/gi
        ],
        xss: [
            /innerHTML/gi,
            /outerHTML/gi,
            /document\.write/gi,
            /dangerouslySetInnerHTML/gi
        ]
    };

    /**
     * Analyze document for taint flows
     */
    analyze(document: vscode.TextDocument): TaintVulnerability[] {
        this.taintedVars.clear();
        const text = document.getText();
        const lines = text.split('\n');
        const vulnerabilities: TaintVulnerability[] = [];

        // Phase 1: Identify tainted sources
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            this.identifyTaintedSources(line, lineNum);
        });

        // Phase 2: Track data flow
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            this.trackDataFlow(line, lineNum);
        });

        // Phase 3: Detect vulnerabilities at sinks
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            const vulns = this.detectSinkVulnerabilities(line, lineNum);
            vulnerabilities.push(...vulns);
        });

        return vulnerabilities;
    }

    /**
     * Identify variables that receive user input
     */
    private identifyTaintedSources(line: string, lineNum: number): void {
        // Match variable assignments from user input
        const assignmentMatch = line.match(/(?:const|let|var|)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+)/);
        
        if (assignmentMatch) {
            const [, varName, value] = assignmentMatch;
            
            // Check if value comes from user input source
            for (const sourcePattern of this.INPUT_SOURCES) {
                sourcePattern.lastIndex = 0;
                if (sourcePattern.test(value)) {
                    this.taintedVars.set(varName, {
                        name: varName,
                        line: lineNum,
                        source: this.categorizeSource(value),
                        flows: [{
                            line: lineNum,
                            operation: 'assignment'
                        }]
                    });
                    break;
                }
            }
        }
    }

    /**
     * Track how tainted data flows through the code
     */
    private trackDataFlow(line: string, lineNum: number): void {
        // Check for variable assignments involving tainted variables
        const assignmentMatch = line.match(/(?:const|let|var|)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+)/);
        
        if (assignmentMatch) {
            const [, newVar, expression] = assignmentMatch;
            
            // Check if expression uses any tainted variables
            for (const [taintedVar, info] of this.taintedVars.entries()) {
                const varRegex = new RegExp(`\\b${taintedVar}\\b`);
                if (varRegex.test(expression)) {
                    // Propagate taint to new variable
                    const operation = expression.includes('+') || expression.includes('${') 
                        ? 'concatenation' 
                        : 'assignment';
                    
                    this.taintedVars.set(newVar, {
                        name: newVar,
                        line: lineNum,
                        source: info.source,
                        flows: [
                            ...info.flows,
                            {
                                line: lineNum,
                                operation
                            }
                        ]
                    });
                }
            }
        }

        // Track function calls with tainted arguments
        const functionCallMatch = line.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/);
        if (functionCallMatch) {
            const [, funcName, args] = functionCallMatch;
            
            for (const [taintedVar, info] of this.taintedVars.entries()) {
                const varRegex = new RegExp(`\\b${taintedVar}\\b`);
                if (varRegex.test(args)) {
                    // Update flow with function call
                    info.flows.push({
                        line: lineNum,
                        operation: 'function-call'
                    });
                }
            }
        }
    }

    /**
     * Detect vulnerabilities when tainted data reaches dangerous sinks
     */
    private detectSinkVulnerabilities(line: string, lineNum: number): TaintVulnerability[] {
        const vulnerabilities: TaintVulnerability[] = [];

        // Check each sink category
        for (const [sinkType, patterns] of Object.entries(this.DANGEROUS_SINKS)) {
            for (const pattern of patterns) {
                pattern.lastIndex = 0;
                if (pattern.test(line)) {
                    // Check if line uses any tainted variables
                    for (const [varName, info] of this.taintedVars.entries()) {
                        const varRegex = new RegExp(`\\b${varName}\\b`);
                        if (varRegex.test(line)) {
                            vulnerabilities.push({
                                variable: varName,
                                source: info.source,
                                sink: sinkType as any,
                                flow: [
                                    ...info.flows,
                                    {
                                        line: lineNum,
                                        operation: 'function-call',
                                        sink: sinkType as any
                                    }
                                ],
                                severity: this.calculateSeverity(info.source, sinkType),
                                message: `Tainted data from ${info.source} (variable '${varName}') flows to dangerous ${sinkType} sink without sanitization`
                            });
                        }
                    }
                }
            }
        }

        return vulnerabilities;
    }

    /**
     * Categorize input source
     */
    private categorizeSource(value: string): 'user-input' | 'external' | 'file' | 'network' {
        if (/req|request|input|prompt|argv/i.test(value)) {
            return 'user-input';
        } else if (/fetch|axios|http|request/i.test(value)) {
            return 'network';
        } else if (/readFile|open|fopen/i.test(value)) {
            return 'file';
        }
        return 'external';
    }

    /**
     * Calculate severity based on source and sink
     */
    private calculateSeverity(source: string, sink: string): 'critical' | 'high' | 'medium' {
        if (source === 'user-input' && ['sql', 'command', 'eval'].includes(sink)) {
            return 'critical';
        } else if (source === 'network' && ['command', 'eval'].includes(sink)) {
            return 'high';
        } else if (sink === 'xss') {
            return 'high';
        }
        return 'medium';
    }

    /**
     * Generate human-readable flow description
     */
    getFlowDescription(vuln: TaintVulnerability): string {
        const steps = vuln.flow.map((flow, index) => 
            `${index + 1}. Line ${flow.line}: ${flow.operation}${flow.sink ? ` to ${flow.sink} sink` : ''}`
        ).join('\n');
        
        return `Data Flow:\n${steps}`;
    }
}
