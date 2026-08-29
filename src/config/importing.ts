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
    address: ["address", "houseaddress", "location", "street", "addressline1", "addressline2"],
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
    surveyor: ["surveyor", "csw", "chw", "collectedby", "worker", "healthworker"],
    
    // New Extended Admin / House Fields
    consent_status: ["consentstatus", "consent"],
    monthly_income: ["monthlyincome", "income"],
    earning_members: ["earningmembers"],
    housing_type: ["housingtype", "housetype"],
    resident_type: ["residenttype"],
    settlement_type: ["settlementtype"],
    block_no: ["blockno", "block"],
    lane_no: ["laneno", "lane"],
    city: ["city", "town", "village"],
    ward_no: ["wardno", "ward"],
    district: ["district"],
    state: ["state"],
    pin_code: ["pincode", "zipcode", "postalcode"],
    gps_accuracy: ["gpsaccuracy", "accuracy"],
    
    // New Extended Assessment Fields
    assessment_basis: ["assessmentbasis", "basis"],
    clinical_risk: ["clinicalrisk", "risk", "risklevel"],
    lifestyle_risk: ["lifestylerisk"],
    lifestyle_score: ["lifestylescore"],
    bmi: ["bmi", "bodymassindex"],
    bmi_category: ["bmicategory"],
    pulse: ["pulse", "heartrate"],
    spo2: ["spo2", "oxygen"],
    screening_comments: ["screeningcomments", "comments", "notes"],
    
    // Follow-ups and Referrals
    follow_ups: ["followups", "followup", "nextfollowup"],
    referrals: ["referrals", "referral", "referralcount"],
    
    // Member Details
    occupation: ["occupation", "job", "profession"],
    eligible: ["eligible", "eligible30"]
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
