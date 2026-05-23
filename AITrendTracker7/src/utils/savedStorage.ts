import { getAuth } from '@react-native-firebase/auth';
import { BASE_URL } from './config';

/** Helper to get Auth Token */
async function getAuthToken() {
  const currentUser = getAuth().currentUser;
  if (!currentUser) return null;
  return await currentUser.getIdToken();
}

/** Get all saved items from backend */
export async function getSavedItems(): Promise<any[]> {
  try {
    const token = await getAuthToken();
    if (!token) return [];

    const res = await fetch(`${BASE_URL}/api/users/saved`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const json = await res.json();
    return json.success && json.data ? json.data : [];
  } catch (e) {
    console.warn('getSavedItems error:', e);
    return [];
  }
}

/** Save an item to backend */
export async function saveItem(item: any): Promise<void> {
  try {
    const token = await getAuthToken();
    if (!token) return;

    const trendId = item.trendId || item.id || item._id;

    await fetch(`${BASE_URL}/api/users/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ trendId })
    });
  } catch (e) {
    console.warn('saveItem error:', e);
  }
}

/** Unsave an item from backend */
export async function unsaveItem(id: string): Promise<void> {
  try {
    const token = await getAuthToken();
    if (!token) return;

    await fetch(`${BASE_URL}/api/users/save/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (e) {
    console.warn('unsaveItem error:', e);
  }
}

/** Check if an item is saved (checks the current fetched list) */
export async function isItemSaved(id: string): Promise<boolean> {
  try {
    const current = await getSavedItems();
    return current.some(i => (i.trendId || i.id || i._id) === id);
  } catch {
    return false;
  }
}
