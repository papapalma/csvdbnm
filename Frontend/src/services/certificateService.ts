import api from './api';

export interface Certificate {
  id: string;
  file_path: string;
  title: string;
  description?: string | null;
  uploaded_at: string;
  uploaded_by: string;
}

export interface CertificatesResponse {
  trainee_id: string;
  trainee_name: string;
  certificates: Certificate[];
}

class CertificateService {
  /**
   * Get all certificates for a trainee
   */
  async getCertificates(traineeId: string): Promise<CertificatesResponse> {
    const response = await api.get(`/trainees/${traineeId}/certificates`);
    return response.data;
  }

  /**
   * Upload a certificate for a trainee (admin/staff only)
   */
  async uploadCertificate(
    traineeId: string,
    data: {
      file_path: string;
      title: string;
      description?: string;
    }
  ): Promise<{ certificate: Certificate; total_certificates: number }> {
    const response = await api.post(`/trainees/${traineeId}/certificates`, data);
    return response.data;
  }

  /**
   * Delete a certificate (admin/staff only)
   */
  async deleteCertificate(traineeId: string, certificateId: string): Promise<void> {
    await api.delete(`/trainees/${traineeId}/certificates?certificateId=${certificateId}`);
  }

  /**
   * Get certificates for the current trainee (trainee role)
   */
  async getMyCertificates(): Promise<Certificate[]> {
    const response = await api.get('/trainees/me/certificates');
    return response.data.certificates;
  }
}

export default new CertificateService();
