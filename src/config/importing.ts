/**
 * Smart-import pipeline configuration: matching thresholds and field mapping.
 *
 * CANONICAL DATA CONTRACT: Fields mapped here are derived from the Excel source file
 * (111.xlsx, sheet: "Field NCD Export") which is the authoritative data structure.
 *
 * Key Excel columns and their canonical names:
 *   "Eligible (≥30)"  → eligible         (Yes/No)
 *   "Clinical Risk"   → clinical_risk    (LOW/MODERATE/HIGH → maps to low/moderate/high)
 *   "Survey Date"     → survey_date      (used as follow-up anchor if Screening Date empty)
 *   "Screening Date"  → screening_date   (preferred follow-up anchor)
 *   "Follow-ups"      → follow_ups
 *   "Follow-up Count" → follow_up_count
 *   "Referrals"       → referrals
 *   "Referral Count"  → referral_count
 *   "Door No"         → house_number
 *   "RBS"             → blood_sugar
 */
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
    // ── House / Location ────────────────────────────────────────────────
    house_id: ["houseid", "housecode", "hhid", "householdid", "house"],
    house_number: ["housenumber", "houseno", "hno", "doorno", "doornumber", "door"],
    address: ["addressline1", "address", "houseaddress", "location", "street"],
    address_line2: ["addressline2"],
    landmark: ["landmark"],
    locality: ["locality"],
    owner_name: ["ownername", "headofhousehold", "hohname", "owner"],
    latitude: ["latitude", "lat", "gpslat", "ycoordinate"],
    longitude: ["longitude", "lng", "long", "gpslong", "xcoordinate"],
    total_members: ["totalfamilymembers", "totalmembers", "familysize", "membercount"],
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
    consent_status: ["consentstatus", "consent"],
    monthly_income: ["monthlyincome", "income"],
    earning_members: ["earningmembers"],
    gps_accuracy: ["gpsaccuracy", "accuracy"],

    // ── Survey / Health Worker ──────────────────────────────────────────
    surveyor: ["healthworker", "surveyor", "csw", "chw", "collectedby", "worker"],
    /** Survey Date — used as follow-up anchor when Screening Date is absent */
    survey_date: ["surveydate"],

    // ── Member Identity ─────────────────────────────────────────────────
    member_id: ["memberid", "mid", "individualid", "personid"],
    member_name: ["membername", "name", "patientname", "personname"],
    age: ["age", "ageyears", "ageinyears"],
    gender: ["gender", "sex"],
    /**
     * Eligible (≥30) — Excel field with "Yes"/"No" values.
     * This is the PRIMARY eligibility source for follow-up decisions.
     * Do NOT derive eligibility from age alone when this field is present.
     */
    eligible: ["eligible30", "eligible30plus", "eligible"],

    // ── Clinical Assessment ─────────────────────────────────────────────
    screening_date: ["screeningdate", "assessmentdate", "date"],
    assessment_basis: ["assessmentbasis", "basis"],
    known_history: ["knownconditions", "knownhistory", "conditions", "comorbidities"],
    /**
     * Clinical Risk — from Excel: LOW / MODERATE / HIGH
     * Maps directly to internal risk: low / moderate / high
     * This is the PRIMARY source for follow-up risk — do NOT recalculate from vitals
     * when this field is present in the Excel.
     */
    clinical_risk: ["clinicalrisk", "risk", "risklevel"],
    lifestyle_risk: ["lifestylerisk"],
    lifestyle_score: ["lifestylescore"],
    systolic: ["systolicbp", "systolic", "sbp", "bpsystolic"],
    diastolic: ["diastolicbp", "diastolic", "dbp", "bpdiastolic"],
    blood_pressure: ["bp", "bloodpressure", "bpreading"],
    /** RBS (Random Blood Sugar) maps to blood_sugar */
    blood_sugar: ["rbs", "bloodsugar", "sugar", "glucose", "randombloodsugar"],
    height_cm: ["heightcm", "height"],
    weight_kg: ["weightkg", "weight"],
    bmi: ["bmi", "bodymassindex"],
    bmi_category: ["bmicategory"],
    waist: ["waist", "waistcircumference"],
    smoking: ["smoking", "smoker"],
    alcohol: ["alcohol"],
    tobacco: ["tobacco"],
    physical_activity: ["physicalactivity", "activity", "exercise"],
    medication: ["medication", "medicines", "treatment"],
    pulse: ["pulse", "heartrate"],
    spo2: ["spo2", "oxygen"],
    screening_comments: ["screeningcomments", "comments", "notes"],

    // ── Follow-ups & Referrals ──────────────────────────────────────────
    /** Follow-ups — text string of follow-up history from Excel */
    follow_ups: ["followups", "followup", "nextfollowup"],
    /** Follow-up Count — number of follow-ups already done */
    follow_up_count: ["followupcount", "followupscount"],
    /** Referrals — text string of referral history */
    referrals: ["referrals", "referral"],
    /** Referral Count — number of referrals */
    referral_count: ["referralcount", "referralscount"],

    // ── Member Details ──────────────────────────────────────────────────
    occupation: ["occupation", "job", "profession"],
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

export const normaliseHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");
