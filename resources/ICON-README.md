# Icon Setup Instructions

## Converting SVG to PNG

The extension requires a 128x128 PNG icon. You have two options:

### Option 1: Online Conversion (Easiest)
1. Go to https://cloudconvert.com/svg-to-png
2. Upload `resources/icon.svg`
3. Set dimensions to 128x128
4. Download as `icon.png`
5. Save to `resources/icon.png`

### Option 2: Using ImageMagick (Command Line)
```bash
# Install ImageMagick first
# Windows: choco install imagemagick
# Mac: brew install imagemagick
# Linux: sudo apt-get install imagemagick

# Convert
convert resources/icon.svg -resize 128x128 resources/icon.png
```

### Option 3: Using Inkscape
1. Open `resources/icon.svg` in Inkscape
2. File → Export PNG Image
3. Set width and height to 128px
4. Export to `resources/icon.png`

### Option 4: Use Online SVG Editor
1. Go to https://svgviewer.dev/ or https://www.svgeditor.org/
2. Open `resources/icon.svg`
3. Export as PNG (128x128)
4. Save as `resources/icon.png`

## Customizing the Icon

The SVG file can be edited to change:
- Colors (currently using VS Code teal: #4EC9B0)
- Shield shape
- Security symbols
- Background color

Feel free to customize it to match your branding!
