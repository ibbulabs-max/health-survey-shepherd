import { updateHealthThresholdSettings } from "./src/services/settingsService.js";

async function testUpdate() {
  try {
    const res = await updateHealthThresholdSettings(
      "00000000-0000-0000-0000-000000000000",
      "admin",
      { minimum_eligible_age: 35 },
    );
    console.log("Success:", res);
  } catch (err) {
    console.error("Failed:", err);
  }
}
testUpdate();
