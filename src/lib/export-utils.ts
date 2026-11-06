/**
 * Utility functions for exporting application data to CSV / Excel format.
 * Includes UTF-8 BOM (\uFEFF) to ensure Microsoft Excel correctly parses Indonesian accents & currency formatting.
 */

export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | undefined | null)[][]
) {
  const escapeCell = (cell: string | number | undefined | null): string => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(escapeCell).join(",");
  const rowLines = rows.map((row) => row.map(escapeCell).join(","));
  const csvContent = "\uFEFF" + [headerLine, ...rowLines].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | undefined | null)[][]
) {
  const tableHeader = headers
    .map(
      (h) =>
        `<th style="background-color: #6B21A8; color: #FFFFFF; font-weight: bold; border: 1px solid #CBD5E1; padding: 8px; font-family: sans-serif; font-size: 12px;">${h}</th>`
    )
    .join("");

  const tableRows = rows
    .map((row) => {
      const cells = row
        .map(
          (c) =>
            `<td style="border: 1px solid #E2E8F0; padding: 6px; font-family: sans-serif; font-size: 11px;">${
              c !== null && c !== undefined
                ? String(c).replace(/</g, "&lt;").replace(/>/g, "&gt;")
                : "-"
            }</td>`
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const template = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${sheetName}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
      </head>
      <body>
        <table>
          <thead><tr>${tableHeader}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([template], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".xls") ? filename : `${filename}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

