import WhatsAppSession from '../models/WhatsAppSession.js';

class WhatsAppSessionDAO {
  async createSession(sessionData) {
    const session = new WhatsAppSession(sessionData);
    return session.save();
  }

  async findSessionById(sessionId) {
    return WhatsAppSession.findActiveSession(sessionId);
  }

  async updateSessionStatus(sessionId, status, additionalData = {}) {
    const session = await this.findSessionById(sessionId);
    if (!session) return null;
    return session.updateStatus(status, additionalData);
  }

  async deactivateSession(sessionId) {
    const session = await this.findSessionById(sessionId);
    if (!session) return null;
    return session.deactivate();
  }

  async deleteSession(sessionId) {
    return WhatsAppSession.deleteOne({ sessionId });
  }
  
  async deleteAllSessions() {
    return WhatsAppSession.deleteMany({ isActive: false });
  }
}

export default new WhatsAppSessionDAO();

