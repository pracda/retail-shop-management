export function downloadCsv(filename: string, rows: string[][]): void {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const csv = '﻿' + rows.map(r => r.map(escape).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

export function openPrintWindow(title: string, bodyHtml: string): void {
  const win = window.open('', '_blank', 'width=960,height=700')
  if (!win) return
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 24px; }
    h1 { font-size: 17px; font-weight: 700; margin-bottom: 3px; }
    .meta { color: #666; font-size: 10.5px; margin-bottom: 18px; }
    h2 { font-size: 11px; font-weight: 700; margin: 18px 0 6px; padding-bottom: 3px;
         border-bottom: 1px solid #ccc; text-transform: uppercase; letter-spacing: 0.05em; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th { font-weight: 700; text-align: left; padding: 5px 8px; background: #f0f0f0;
         border-bottom: 1.5px solid #bbb; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; }
    th.r, td.r { text-align: right; }
    th.c, td.c { text-align: center; }
    td { padding: 4px 8px; border-bottom: 1px solid #e8e8e8; }
    tr:nth-child(even) td { background: #fafafa; }
    tfoot td { font-weight: 700; background: #efefef; border-top: 1.5px solid #bbb; }
    .dl { font-size: 11px; }
    .dl dt { font-weight: 600; display: inline; color: #555; }
    .dl dt::after { content: ': '; }
    .dl dd { display: inline; margin-right: 20px; }
    .print-btn { margin-top: 20px; text-align: right; }
    .print-btn button { padding: 7px 18px; font-size: 12px; cursor: pointer;
                        background: #1a56db; color: #fff; border: none; border-radius: 4px; font-family: inherit; }
    @media print { .print-btn { display: none; } @page { margin: 15mm; } }
  </style>
</head>
<body>
${bodyHtml}
<div class="print-btn"><button onclick="window.print()">Print / Save as PDF</button></div>
</body>
</html>`)
  win.document.close()
  win.focus()
}

export function buildHtmlTable(
  headers: Array<string | { label: string; align?: 'r' | 'c' }>,
  rows: string[][],
  totalsRow?: string[],
): string {
  const thCells = headers
    .map((h) => {
      const label = typeof h === 'string' ? h : h.label
      const cls   = typeof h === 'object' && h.align ? ` class="${h.align}"` : ''
      return `<th${cls}>${label}</th>`
    })
    .join('')

  const tdRows = rows
    .map((row) =>
      `<tr>${row
        .map((cell, ci) => {
          const h = headers[ci]
          const cls = typeof h === 'object' && h.align ? ` class="${h.align}"` : ''
          return `<td${cls}>${cell}</td>`
        })
        .join('')}</tr>`,
    )
    .join('')

  const foot = totalsRow
    ? `<tfoot><tr>${totalsRow
        .map((cell, ci) => {
          const h = headers[ci]
          const cls = typeof h === 'object' && h.align ? ` class="${h.align}"` : ''
          return `<td${cls}>${cell}</td>`
        })
        .join('')}</tr></tfoot>`
    : ''

  return `<table><thead><tr>${thCells}</tr></thead><tbody>${tdRows}</tbody>${foot}</table>`
}
