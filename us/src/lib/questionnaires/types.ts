export interface DeviceDetails { brandId: string; brand: string; model: string; variant: string; colour: string; }
export interface CustomerDetails { fullName: string; mobile: string; email: string; pinCode: string; address: string; street: string; landmark: string; city: string; }
export interface UploadedLocalFile { id: string; name: string; type: string; size: number; file: File; }

export interface BuySubmission {
  journey: "buy"; device: DeviceDetails; preferences: { budget: string; condition: string; batteryHealth: string; warranty: string; accessories: string[] };
  usage: { primaryUse: string; priorities: string[]; notes: string }; selectedProduct: { id: string; source: "mock" | "request" } | null;
  customer: CustomerDetails; fulfilment: { method: string; address: string }; mockMode: true;
}

export interface SellSubmission {
  journey: "sell"; device: DeviceDetails & { region: string; age: string; purchaseBill: string };
  screenCondition: { code: string; id: string; followUps: Record<string, string> };
  bodyCondition: { code: string; id: string; followUps: Record<string, string> };
  batteryCondition: { code: string; healthKnown: string; percentage: number | null; drain: string; unexpectedShutdown: string; replacement: string; swollen: string };
  functionalCondition: Record<string, string>; waterDamage: { code: string; when: string; currentlyWorks: string; professionallyRepaired: string };
  repairHistory: string[]; originalParts: string; accessories: string[]; ownership: string; activationLock: string; photographs: Record<string, UploadedLocalFile[]>;
  customer: CustomerDetails; preference: { method: string; contactTime: string }; mockMode: true;
}

export interface RepairSubmission {
  journey: "repair"; device: DeviceDetails & { powersOn: string }; selectedIssues: string[];
  diagnostics: Record<string, Record<string, string>>; generalCondition: Record<string, string>; additionalProblems: string;
  photographs: UploadedLocalFile[]; customer: CustomerDetails; servicePreference: { method: string; date: string; time: string };
  mockMode: true;
}
