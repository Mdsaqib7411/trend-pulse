import { getAuth } from '@react-native-firebase/auth';
import { BASE_URL } from './config';

export const trackInteraction = async (trendId: string, actionType: 'click' | 'bookmark' | 'skip') => {
  try {
    const currentUser = getAuth().currentUser;
    if (!currentUser) return;
    const token = await currentUser.getIdToken();
    
    await fetch(`${BASE_URL}/api/trends/interact`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ trendId, interactionType: actionType })
    });
  } catch (error) {
    // Silent fail for non-critical tracking
    console.warn('Interaction tracking failed', error);
  }
};
