import * as ExcelJS from 'exceljs';
import { currencyDecimals, formatReportDate, renderReportWorkbook } from './report-workbook';

describe('report workbook (REPORT-XLSX-1)', () => {
  it('renders title, info lines, grey header and typed cells', async () => {
    const buf = await renderReportWorkbook(
      [
        {
          name: 'Sales',
          title: 'Отчет о продажах с 24.09.2026 по 24.09.2026',
          infoLines: ['За период: с 24.09.2026 по 24.09.2026', 'Склад(ы): Bar, Kitchen'],
          columns: [
            { header: 'Группа', kind: 'text' },
            { header: 'Элемент номенклатуры', kind: 'text' },
            { header: 'Количество', kind: 'qty' },
            { header: 'Выручка', kind: 'money' },
            { header: 'Себестоимость, %', kind: 'percent' },
          ],
          rows: [
            { cells: ['Salads', 'Caesar', 12, 300, 0.3] },
            { cells: ['Итого', null, 12, 300, 0.3], style: 'total' },
          ],
        },
      ],
      { moneyDecimals: 2 },
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Sales')!;
    expect(ws.getCell('A1').value).toBe('Отчет о продажах с 24.09.2026 по 24.09.2026');
    expect(ws.getCell('A3').value).toBe('Склад(ы): Bar, Kitchen');
    expect(ws.getCell('B4').value).toBe('Элемент номенклатуры');
    expect((ws.getCell('A4').fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFD9D9D9');
    expect(ws.getCell('D5').value).toBe(300);
    expect(ws.getCell('D5').numFmt).toBe('#,##0.00');
    expect(ws.getCell('E5').numFmt).toBe('0.00%');
    expect(ws.getCell('A6').font?.bold).toBe(true);
  });

  it('formats dates and currency digits', () => {
    expect(formatReportDate('2026-09-24')).toBe('24.09.2026');
    expect(currencyDecimals('USD')).toBe(2);
    expect(currencyDecimals('???')).toBe(2);
  });
});
