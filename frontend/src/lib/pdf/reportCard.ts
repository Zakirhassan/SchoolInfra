// "Report card" = the certificate. In the old backend, generateReportCard filled
// CERTIFICATE_TEMPLATE.pdf; there was never a separate report-card layout.
// Takes the JSON from GET /api/reports/student/:studentId/exam/:examId.
import { generateCertificate } from './certificate.ts';
import type { Loader } from './common.ts';

export type ReportCardData = { student: any; marks: any[]; exam: any; schoolInfo: any };

export const generateReportCard = generateCertificate;

export const generateReportCardFromData = (data: ReportCardData, loader?: Loader) =>
    generateCertificate(data.student, data.marks, data.exam, data.schoolInfo, loader);
