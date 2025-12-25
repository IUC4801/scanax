// Scanax Vulnerability Test Suite - Java
// This file contains intentional security vulnerabilities for testing purposes only

import java.sql.*;
import java.io.*;
import javax.servlet.http.*;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;

@SpringBootApplication
public class VulnerableApplication {

    // ============================================
    // VULNERABILITY: Hardcoded Secrets
    // ============================================
    private static final String DB_PASSWORD = "root_password_12345";
    private static final String API_KEY = "sk-proj-1234567890abcdefghijklmn";
    private static final String PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA1234567890abcdefghijklmnopqrstuvwxyz\n-----END RSA PRIVATE KEY-----";

    // ============================================
    // VULNERABILITY: SQL Injection
    // ============================================
    @GetMapping("/user/{id}")
    public String getUserById(@PathVariable String id) throws SQLException {
        String dbUrl = "jdbc:mysql://localhost:3306/mydb";
        String dbUser = "admin";
        String dbPassword = DB_PASSWORD;
        
        Connection conn = DriverManager.getConnection(dbUrl, dbUser, dbPassword);
        // Unsanitized user input directly concatenated into SQL query
        String query = "SELECT * FROM users WHERE user_id = " + id;
        Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery(query);
        
        return "User data retrieved";
    }

    // ============================================
    // VULNERABILITY: Command Injection
    // ============================================
    @PostMapping("/execute-command")
    public String executeCommand(@RequestParam String cmd) throws IOException {
        // User input is directly passed to shell command without sanitization
        Process process = Runtime.getRuntime().exec(cmd);
        BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
        String line;
        StringBuilder output = new StringBuilder();
        
        while ((line = reader.readLine()) != null) {
            output.append(line).append("\n");
        }
        
        return output.toString();
    }

    // ============================================
    // VULNERABILITY: Path Traversal
    // ============================================
    @GetMapping("/download")
    public byte[] downloadFile(@RequestParam String filename) throws IOException {
        // User input is used directly in file path without validation
        String filePath = "/uploads/" + filename;
        File file = new File(filePath);
        FileInputStream fis = new FileInputStream(file);
        byte[] fileData = new byte[(int) file.length()];
        fis.read(fileData);
        fis.close();
        
        return fileData;
    }

    // ============================================
    // VULNERABILITY: Insecure Cryptography
    // ============================================
    public String encryptPassword(String password) throws Exception {
        // Using MD5 which is cryptographically weak
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] messageDigest = md.digest(password.getBytes());
        StringBuilder sb = new StringBuilder();
        
        for (byte b : messageDigest) {
            sb.append(String.format("%02x", b));
        }
        
        return sb.toString();
    }

    public static void main(String[] args) {
        SpringApplication.run(VulnerableApplication.class, args);
    }
}
