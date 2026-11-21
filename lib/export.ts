export const exportToCSV = (data: any[], filename: string, columns: { key: string, label: string }[]) => {
  if (data.length === 0) return;

  // Create header row
  const header = columns.map(c => `"${c.label}"`).join(',');
  
  // Create data rows (handle commas inside strings)
  const rows = data.map(row => {
    return columns.map(c => {
      const val = row[c.key] ?? '';
      const text = String(val);
      // Spreadsheet cells beginning with formula operators must be escaped.
      const safeText = typeof val === 'string' && /^[\\u0000-\\u0020]*[=+\\-@]/.test(text)
        ? `'${text}`
        : text;
      return `"${safeText.replace(/"/g, '""')}"`; // Escape quotes and formula injection
    }).join(',');
  });

  const csvContent = [header, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};