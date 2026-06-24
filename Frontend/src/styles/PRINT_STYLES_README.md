# Print-Specific CSS Styling Documentation

## Overview

This document describes the print-specific CSS styling implemented in `globals.css` for the Admin Report Print Button feature.

## Implementation Location

All print-specific styles are located in `Frontend/src/styles/globals.css` under the `@media print` section.

## Features Implemented

### 1. Page Setup (Requirements 2.7, 5.3)
- **Page Size**: Letter size (8.5" x 11")
- **Margins**: 0.75in (top, right, left), 1in (bottom)
- Configured using `@page` rule

### 2. Color Scheme (Requirements 2.6, 5.1)
- **Text Color**: Black (#000000)
- **Background**: White (#ffffff)
- Removes all shadows and effects for optimal print contrast
- Forces black text on white background for all elements

### 3. Typography (Requirement 5.2)
- **Body Text**: 10pt minimum (readable size)
- **Headings**: 
  - H1: 18pt (main title)
  - H2: 14pt (section headings)
  - H3: 12pt (sub-sections)
- **Font Family**: Inter, system fonts
- **Line Height**: 1.5 for readability

### 4. Hidden Elements (Requirements 2.5, 4.5)
The following elements are hidden during print:
- Navigation elements (`nav`, `[role="navigation"]`)
- Headers and footers (`header`, `footer`)
- Sidebars (`aside`, `.sidebar`)
- All buttons (`button`, `.btn`, `.button`)
- Form inputs (`input`, `select`, `textarea`)
- Charts and SVGs (`.recharts-wrapper`, `canvas`, `svg`)
- Elements with `.print-hidden` or `.no-print` classes

### 5. Section Spacing (Requirement 5.3)
- **Minimum Section Spacing**: 0.5 inches between major sections
- **Header Margin**: 0.25in bottom
- **Section Margins**: 0.5in top for H2 headings
- **Table Margins**: 0.5in bottom

### 6. Page Break Rules (Requirements 5.4, 5.6)
- **Avoid Breaking**: Tables, headings, and major sections
- **Table Handling**: `page-break-inside: avoid` for tables
- **Heading Handling**: `page-break-after: avoid` for all headings
- **Row Handling**: `page-break-inside: avoid` for table rows
- **Header Repetition**: Table headers repeat on each page

### 7. Table Styling (Requirement 5.7)
- **Borders**: 1pt solid black for all cells
- **Cell Padding**: 0.08in vertical, 0.1in horizontal
- **Header Background**: Light gray (#f0f0f0) for distinction
- **Border Collapse**: Collapsed for clean appearance
- **Gridlines**: Visible on all cells for readability

## Component-Specific Styles

### Print Container
```css
.print-container {
  display: block !important;
  width: 100%;
  max-width: 100%;
}
```

### Print Header
- Centered text alignment
- 20pt font size for main title
- 0.5in bottom margin

### Print Metadata
- 0.5in bottom margin
- Bottom border (1pt solid black)
- Displays date range, report type, and generation timestamp

### Summary Stats Table
- 2x2 grid layout
- Light gray background for headers (#e8e8e8)
- Equal column widths (25% each)

### Data Tables (Activity, Category, Program)
- Full width (100%)
- Left-aligned text
- Clear column headers
- Borders on all cells

### Print Footer
- Top border (1pt solid black)
- Centered text
- 9pt font size
- Displays generation timestamp

## Screen vs Print Behavior

### Screen Display
```css
@media screen {
  .print-container {
    display: none;
  }
}
```
The print container is hidden on screen and only visible during print preview.

### Print Display
All screen-only elements (navigation, buttons, forms) are hidden, and the print container becomes visible.

## Utility Classes

### Page Break Control
- `.page-break-before`: Force page break before element
- `.page-break-after`: Force page break after element
- `.page-break-avoid`: Prevent page break inside element

### Visibility Control
- `.print-hidden`: Hide element during print
- `.no-print`: Hide element during print
- `.print-visible`: Show element during print (for SVGs)

## Link Handling

Links are styled to:
- Remove underlines
- Display in black color
- Show URLs after link text (except for anchor links)
- Use 9pt italic font for URLs

## Accessibility Features

- Semantic HTML structure (table, thead, tbody, th, td)
- Proper heading hierarchy (h1, h2, h3)
- Abbreviations expanded with `attr(title)`
- Logical reading order maintained

## Browser Compatibility

The print styles use standard CSS features supported by:
- Chrome/Edge (Chromium)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Mobile)

## Testing Recommendations

1. **Visual Testing**: Use browser print preview to verify layout
2. **Page Breaks**: Check that tables don't break awkwardly
3. **Typography**: Verify font sizes are readable (minimum 10pt)
4. **Spacing**: Confirm 0.5in minimum section spacing
5. **Borders**: Ensure table borders are visible and clean
6. **Hidden Elements**: Verify navigation and buttons are hidden

## Future Enhancements

Potential improvements for future iterations:
- Custom page size selection
- Configurable margins
- Optional header/footer content
- Page number styling
- Landscape orientation support
- Multi-column layouts for specific sections

## Related Files

- **Component**: `Frontend/src/components/PrintableReport.tsx`
- **Utilities**: `Frontend/src/utils/printFormatters.ts`
- **Tests**: `Frontend/src/components/__tests__/PrintableReport.test.tsx`
- **Page**: `Frontend/src/pages/ReportsPage.tsx`

## Requirements Mapping

| Requirement | Implementation |
|-------------|----------------|
| 2.4 | Print-optimized CSS with page breaks |
| 2.5 | Hidden navigation, buttons, interactive UI |
| 2.6 | Black text on white background |
| 2.7 | Letter-size page margins (8.5" x 11") |
| 5.1 | Black text on white background |
| 5.2 | Readable font sizes (10pt body, 14pt headings) |
| 5.3 | Section spacing (0.5 inches minimum) |
| 5.4 | Page break rules to avoid breaking tables |
| 5.5 | Page numbers in footer (CSS @page) |
| 5.6 | Page breaks at logical section boundaries |
| 5.7 | Table borders and gridlines for readability |

## Notes

- The `@page` rule for page numbers is defined but may require browser-specific implementation
- Some browsers may not support all CSS print features (e.g., page numbers)
- Print-to-PDF functionality is browser-dependent
- The styles are optimized for letter-size paper but will scale to other sizes
