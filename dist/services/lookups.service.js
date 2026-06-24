"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDefaultLookups = seedDefaultLookups;
exports.getAllLookups = getAllLookups;
exports.getLookupCategory = getLookupCategory;
const database_1 = require("../db/database");
const DEFAULT_LOOKUPS = {
    class: [
        { value: 'Class 1', label: 'Class 1' },
        { value: 'Class 2', label: 'Class 2' },
        { value: 'Class 3', label: 'Class 3' },
        { value: 'Class 4', label: 'Class 4' },
        { value: 'Class 5', label: 'Class 5' },
        { value: 'Class 6', label: 'Class 6' },
        { value: 'Class 7', label: 'Class 7' },
        { value: 'Class 8', label: 'Class 8' },
        { value: 'Class 9', label: 'Class 9' },
        { value: 'Class 10', label: 'Class 10' },
        { value: 'Class 11', label: 'Class 11' },
        { value: 'Class 12', label: 'Class 12' },
        { value: 'B.Tech', label: 'B.Tech' },
        { value: 'M.Tech', label: 'M.Tech' },
        { value: 'MCA', label: 'MCA' },
        { value: 'MBA', label: 'MBA' },
        { value: 'BCA', label: 'BCA' },
    ],
    grade: [
        { value: 'A+', label: 'A+' },
        { value: 'A', label: 'A' },
        { value: 'B+', label: 'B+' },
        { value: 'B', label: 'B' },
        { value: 'C', label: 'C' },
        { value: 'D', label: 'D' },
    ],
    section: [
        { value: 'A', label: 'Section A' },
        { value: 'B', label: 'Section B' },
        { value: 'C', label: 'Section C' },
        { value: 'D', label: 'Section D' },
    ],
    status: [
        { value: 'new_admission', label: 'New Admission' },
        { value: 'pending_approval', label: 'Pending Approval' },
        { value: 'pending_docs', label: 'Pending Documents' },
        { value: 'active', label: 'Active' },
        { value: 'on_leave', label: 'On Leave' },
        { value: 'graduated', label: 'Graduated' },
        { value: 'inactive', label: 'Inactive' },
    ],
    feeStatus: [
        { value: 'paid', label: 'Paid' },
        { value: 'partial', label: 'Partial' },
        { value: 'overdue', label: 'Overdue' },
        { value: 'not_applicable', label: 'Not Applicable' },
    ],
};
function seedDefaultLookups() {
    (0, database_1.getRepository)().seedLookups(DEFAULT_LOOKUPS);
}
function getAllLookups() {
    const repo = (0, database_1.getRepository)();
    const lookups = repo.getAllLookups();
    const hasData = Object.values(lookups).some((options) => options.length > 0);
    return hasData ? lookups : DEFAULT_LOOKUPS;
}
function getLookupCategory(category) {
    const repo = (0, database_1.getRepository)();
    const options = repo.getLookupCategory(category);
    if (options === null) {
        return null;
    }
    if (options.length > 0) {
        return options;
    }
    return DEFAULT_LOOKUPS[category] ?? [];
}
