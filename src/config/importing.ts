/** Smart-import pipeline configuration: matching thresholds and field mapping. */
export const importConfig = {
  acceptedExtensions: [".xlsx", ".xls", ".csv"],
  maxFiles: 20,
  /** Confidence (0-1) at or above which two records are treated as the same person. */
  identity: {
    autoMatch: 0.95,
    possibleMatch: 0.6,
    weights: { name: 0.4, age: 0.2, gender: 0.15, house: 0.15, vitals: 0.1 },
    maxAgeDifference: 3,
  },
  /**
   * Canonical field -> possible spreadsheet header aliases (lower-cased,
   * non-alphanumerics stripped). Unknown columns are surfaced as new fields
   * instead of being dropped.
   */
  aliases: {
    house_id: ["houseid", "housecode", "hhid", "householdid", "house"],
    house_number: ["housenumber", "houseno", "hno", "doorno"],
    address: ["address", "houseaddress", "location", "street"],
    owner_name: ["ownername", "headofhousehold", "hohname", "owner"],
    latitude: ["latitude", "lat", "gpslat", "ycoordinate"],
    longitude: ["longitude", "lng", "long", "gpslong", "xcoordinate"],
    total_members: ["totalmembers", "familysize", "membercount"],
    member_id: ["memberid", "mid", "individualid", "personid"],
    member_name: ["membername", "name", "patientname", "personname"],
    age: ["age", "ageyears", "ageinyears"],
    gender: ["gender", "sex"],
    systolic: ["systolic", "sbp", "bpsystolic"],
    diastolic: ["diastolic", "dbp", "bpdiastolic"],
    blood_pressure: ["bp", "bloodpressure", "bpreading"],
    blood_sugar: ["bloodsugar", "sugar", "rbs", "glucose", "randombloodsugar"],
    known_history: ["knownconditions", "knownhistory", "conditions", "comorbidities"],
    medication: ["medication", "medicines", "treatment"],
    height_cm: ["height", "heightcm"],
    weight_kg: ["weight", "weightkg"],
    waist: ["waist", "waistcircumference"],
    smoking: ["smoking", "smoker"],
    alcohol: ["alcohol"],
    tobacco: ["tobacco"],
    physical_activity: ["physicalactivity", "activity", "exercise"],
    screening_date: ["screeningdate", "surveydate", "date", "assessmentdate"],
    surveyor: ["surveyor", "csw", "chw", "collectedby", "worker"],
  } as Record<string, string[]>,
  conditionVocabulary: [
    "Hypertension",
    "Diabetes",
    "Heart Disease",
    "Stroke",
    "Kidney Disease",
    "Asthma / COPD",
    "Thyroid",
    "Cancer",
    "Tuberculosis",
  ],
} as const;

export const normaliseHeader = (header: string) =>
  header.toLowerCase().replace(/[^a-z0-9]/g, "");
