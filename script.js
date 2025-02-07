let updatedSheet = [];

document.getElementById('processBtn').addEventListener('click', async function () {
    const masterFile = document.getElementById('masterFile').files[0];
    const dataFile = document.getElementById('dataFile').files[0];

    if (!masterFile || !dataFile) {
        alert("Please upload both files.");
        return;
    }

    const workbook = await readExcelWorkbook(masterFile);
    const masterSheet = await readExcel(workbook, "Data");
    const dataCSV = await readCSV(dataFile);

    console.log("Master Sheet Data:", masterSheet);
    console.log("Data CSV:", dataCSV);

    updatedSheet = updateMasterSheet(masterSheet, dataCSV, workbook.Sheets["Data"]);
    console.log("Updated Sheet:", updatedSheet);

    downloadUpdatedExcel(workbook);
});

async function readExcelWorkbook(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            resolve(workbook);
        };
        reader.readAsArrayBuffer(file);
    });
}

async function readExcel(workbook, sheetNameToRead) {
    const sheetName = workbook.SheetNames.includes(sheetNameToRead) ? sheetNameToRead : workbook.SheetNames[0];
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
}

async function readCSV(file) {
    return new Promise((resolve) => {
        Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
                if (!results.data.length) {
                    console.error("⚠ CSV file is empty or incorrectly formatted.");
                    resolve([]);
                    return;
                }

                let rawHeaders = results.data[1].map(h => h.trim().replace(/\s+/g, " "));
                console.log("Corrected CSV Headers:", rawHeaders);

                let cleanedData = results.data.slice(1).map(row => {
                    let newRow = {};
                    rawHeaders.forEach((header, index) => {
                        newRow[header] = row[index] || "";
                    });
                    return newRow;
                });

                console.log("Final CSV Headers:", Object.keys(cleanedData[0] || {}));
                resolve(cleanedData);
            },
        });
    });
}

function updateMasterSheet(masterSheet, dataCSV, worksheet) {
    console.log("Master Sheet Headers:", Object.keys(masterSheet[0] || {}));
    console.log("CSV Headers:", Object.keys(dataCSV[0] || {}));

    let areaKeyMaster = "Area (Sqm)";
    let areaKeyCSV = Object.keys(dataCSV[0]).find(k => k.toLowerCase().includes("area"));
    let facadeKeyMaster = "Façade Type";
    let facadeKeyCSV = "Type";

    console.log(`✅ Matched Columns: Master Sheet -> ${areaKeyMaster}, Data.csv -> ${areaKeyCSV}`);
    console.log(`✅ Matched Columns: Master Sheet -> ${facadeKeyMaster}, Data.csv -> ${facadeKeyCSV}`);

    if (!areaKeyCSV || !facadeKeyCSV) {
        console.warn("⚠ Required columns not found in Data CSV.");
        return masterSheet;
    }

    masterSheet.forEach((row, rowIndex) => {
        delete row['__EMPTY'];
        delete row['__EMPTY_1'];
        delete row['__EMPTY_2'];
        delete row['__EMPTY  '];
        delete row['%Ä F aça de Typ e & Sub Typ e will refl ect her e a uto mat ical ly h ere wit h hi ghli ght ed cell'];

        const match = dataCSV.find((csvRow) =>
            (csvRow['Model']?.toString().trim() || "") === (row['Facade Type']?.toString().trim() || "") &&  
            (csvRow['Type Mark']?.toString().trim() || "") === (row['Sub Type']?.toString().trim() || "") &&  
            (csvRow['Area']?.toString().trim() || "") === (row['Glass (Sqm)']?.toString().trim() || "")  
        );

        if (match) {
            console.log(`✅ Matching Row Found at index ${rowIndex}:`, match);
            console.log(`Before Update [Row ${rowIndex}]: Area ->`, row[areaKeyMaster], ", Façade Type ->", row[facadeKeyMaster]);

            row[areaKeyMaster] = match[areaKeyCSV] || "";
            row[facadeKeyMaster] = match[facadeKeyCSV] || "";

            console.log(`After Update [Row ${rowIndex}]: Area ->`, row[areaKeyMaster], ", Façade Type ->", row[facadeKeyMaster]);
        } else {
            console.log(`❌ No Match for Row ${rowIndex}`);
        }
    });

    return masterSheet;
}

function downloadUpdatedExcel(workbook) {
    const updatedWorksheet = XLSX.utils.json_to_sheet(updatedSheet, { raw: true });

    
    if (workbook.SheetNames.includes("Data")) {
        workbook.Sheets["Updated Data"] = updatedWorksheet;
        workbook.SheetNames = workbook.SheetNames.map(sheet => (sheet === "Data" ? "Updated Data" : sheet));
    }

    console.log("Final Workbook Sheets:", workbook.SheetNames);
    
    XLSX.writeFile(workbook, "Updated_Master_Sheet.xlsx");
}


// Function to export the updated sheet as a PDF
document.getElementById('exportPDF').addEventListener('click', function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.autoTable({
        head: [Object.keys(updatedSheet[0] || {})],
        body: updatedSheet.map(row => Object.values(row)),
    });

    doc.save("Updated_Master_Sheet.pdf");
});
