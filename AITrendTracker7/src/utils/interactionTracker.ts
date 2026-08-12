import { getAuth } from '@react-native-firebase/auth';
import { BASE_URL } from './config';
import intelligenceSyncService from '../services/intelligenceSyncService';

export const trackInteraction = async (
  trendId: string,
  actionType: 'click' | 'bookmark' | 'skip',
  category = 'General',
  keywords: string[] = []
) => {
  const dbAction = actionType === 'skip' ? 'click' : actionType;

  try {
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      // Guest or offline queuing fallback
      intelligenceSyncService.queueActivity(trendId, dbAction, category, keywords);
      return;
    }
    const token = await currentUser.getIdToken();
    
    const response = await fetch(`${BASE_URL}/api/trends/interact`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ trendId, interactionType: dbAction })
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }
  } catch (error) {
    console.warn('Interaction tracking failed. Queueing activity offline.', error);
    intelligenceSyncService.queueActivity(trendId, dbAction, category, keywords);
  }
};
