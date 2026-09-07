const XLSX = require("xlsx");

const workbook = XLSX.readFile("../111.xlsx");
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

if (json.length > 0) {
  console.log("Columns in 111.xlsx:", json[0]);
}

const workbook2 = XLSX.readFile("../Tribal 1.xlsx");
const sheetName2 = workbook2.SheetNames[0];
const sheet2 = workbook2.Sheets[sheetName2];
const json2 = XLSX.utils.sheet_to_json(sheet2, { header: 1 });

if (json2.length > 0) {
  console.log("Columns in Tribal 1.xlsx:", json2[0]);
}
