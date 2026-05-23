import { io, Socket } from 'socket.io-client';
import { BASE_URL } from '../utils/config';
import { store } from '../store';
import { addRealtimeTrendsBatch, Trend } from '../store/slices/trendsSlice';
import { addGeoSpike } from '../store/slices/geoSlice';
import { addSystemAlert } from '../store/slices/notificationsSlice';
import { updatePredictionNode } from '../store/slices/predictionSlice';

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  
  // Batched Reorder Queue
  private trendBatch: Trend[] = [];
  private batchTimerId: ReturnType<typeof setTimeout> | null = null;

  public connect(token?: string) {
    if (this.socket && this.socket.connected) return;

    this.socket = io(BASE_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: token ? { token } : undefined,
    });

    this.socket.on('connect', () => {
      console.log('[SocketService] Connected to real-time feed');
      this.isConnected = true;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[SocketService] Disconnected:', reason);
      this.isConnected = false;
      this.clearBatchQueue();
    });

    this.socket.on('connect_error', (error) => {
      console.error('[SocketService] Connection Error:', error.message);
    });

    // 1. Live Trend Webhook -> 500ms Throttled Redux Batch
    this.socket.on('trend_emerging', (data: Trend) => {
      this.trendBatch.push(data);
      if (!this.batchTimerId) {
        // Start a 500ms batching window to prevent layout thrashing during storms
        this.batchTimerId = setTimeout(this.flushTrendBatch, 500);
      }
    });

    // 2. Geo Spike Webhook -> Redux
    this.socket.on('geo_spike_detected', (data) => {
      store.dispatch(addGeoSpike(data));
    });

    // 3. System Alert Webhook -> Redux
    this.socket.on('system_alert', (data) => {
      store.dispatch(addSystemAlert(data));
    });

    // 4. AI Prediction Webhook -> Redux
    this.socket.on('ai_prediction_update', (data) => {
      store.dispatch(updatePredictionNode(data));
    });
  }

  private flushTrendBatch = () => {
    if (this.trendBatch.length > 0) {
      store.dispatch(addRealtimeTrendsBatch([...this.trendBatch]));
      this.trendBatch = [];
    }
    this.batchTimerId = null;
  };

  private clearBatchQueue() {
    if (this.batchTimerId) {
      clearTimeout(this.batchTimerId);
      this.batchTimerId = null;
    }
    this.trendBatch = [];
  }

  public disconnect() {
    if (this.socket) {
      this.socket.off('connect');
      this.socket.off('disconnect');
      this.socket.off('connect_error');
      this.socket.off('trend_emerging');
      this.socket.off('geo_spike_detected');
      this.socket.off('system_alert');
      this.socket.off('ai_prediction_update');
      
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.clearBatchQueue();
      console.log('[SocketService] Disconnected and cleaned up listeners.');
    }
  }

  public getConnectionStatus() {
    return this.isConnected;
  }
}

export const socketService = new SocketService();
