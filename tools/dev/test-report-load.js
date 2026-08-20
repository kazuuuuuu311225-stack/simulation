const fs = require("fs");
const vm = require("vm");

const files = [
  "js/specific-heat-inquiry/storage.js",
  "js/specific-heat-inquiry/steps.js",
  "js/specific-heat-inquiry/report.js",
];

const globalObj = {
  window: {},
  console,
  document: {
    createElement() {
      return {
        style: {},
        setAttribute() {},
        appendChild() {},
        querySelector() { return null; },
        replaceChildren() {},
      };
    },
    body: { appendChild() {} },
    getElementById() { return null; },
    fonts: { ready: Promise.resolve() },
  },
  InquiryStorage: null,
  InquirySteps: null,
  InquiryCompanion: { getMode: () => "gentle", generateComment: () => "" },
  InquiryMissions: {
    getMission: () => null,
    getHypothesis: () => null,
    getPlan: () => null,
  },
};

globalObj.window = globalObj;

for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  try {
    vm.runInContext(code, globalObj, { filename: file });
    console.log("OK:", file);
  } catch (err) {
    console.error("FAIL:", file, err.message);
    if (err.stack) console.error(err.stack.split("\n").slice(0, 5).join("\n"));
    process.exit(1);
  }
}

console.log("InquiryReport:", typeof globalObj.InquiryReport);
if (globalObj.InquiryReport) {
  try {
    const data = {
      results: [{ materialKey: "water", materialName: "水", interval: "液体", mass: 500, heatQ: 2000, initialCelsius: 20, finalCelsius: 25, deltaT: 5 }],
      planChecks: { material: true },
      heatMeasureLog: [],
      customGraphs: [],
      graphsCreated: { water: true },
      qtCurves: { water: [{ q: 0, t: 20 }] },
      timeline: [],
      exportedAt: new Date().toISOString(),
    };
    const blocks = globalObj.InquiryReport.buildBlocks(data);
    console.log("buildBlocks OK, blocks:", blocks.length);
  } catch (err) {
    console.error("buildBlocks FAIL:", err.message);
    process.exit(1);
  }
}
