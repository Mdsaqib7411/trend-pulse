/**
 * AI Telemetry Service — Lightweight in-memory analytics for cross-gateway resilience.
 *
 * Tracks provider-specific success/failure rates, average latencies, and fallback activations.
 */

class AITelemetryService {
    constructor() {
        this.metrics = {
            'Gemini Direct': {
                providerName: 'Gemini Direct',
                gatewayName: 'Google SDK',
                successCount: 0,
                failureCount: 0,
                fallbackActivations: 0,
                averageLatency: 0,
                totalLatency: 0,
                lastError: null,
                status: 'Healthy'
            },
            'Gemini OpenRouter': {
                providerName: 'Gemini OpenRouter',
                gatewayName: 'OpenRouter',
                successCount: 0,
                failureCount: 0,
                fallbackActivations: 0,
                averageLatency: 0,
                totalLatency: 0,
                lastError: null,
                status: 'Healthy'
            },
            'Llama 3 OpenRouter': {
                providerName: 'Llama 3 OpenRouter',
                gatewayName: 'OpenRouter',
                successCount: 0,
                failureCount: 0,
                fallbackActivations: 0,
                averageLatency: 0,
                totalLatency: 0,
                lastError: null,
                status: 'Healthy'
            },
            'Qwen 2.5 OpenRouter': {
                providerName: 'Qwen 2.5 OpenRouter',
                gatewayName: 'OpenRouter',
                successCount: 0,
                failureCount: 0,
                fallbackActivations: 0,
                averageLatency: 0,
                totalLatency: 0,
                lastError: null,
                status: 'Healthy'
            },
            'Local Fallback': {
                providerName: 'Local Fallback',
                gatewayName: 'In-Memory',
                activeCount: 0
            }
        };
    }

    /**
     * Record a successful LLM invocation with its latency.
     */
    recordSuccess(provider, latencyMs) {
        const m = this.metrics[provider];
        if (m) {
            m.successCount++;
            m.totalLatency += latencyMs;
            m.averageLatency = Math.round(m.totalLatency / m.successCount);
            m.status = 'Healthy';
        }
    }

    /**
     * Record a failed LLM invocation with the error message.
     */
    recordFailure(provider, errorMsg) {
        const m = this.metrics[provider];
        if (m) {
            m.failureCount++;
            m.lastError = {
                message: errorMsg,
                timestamp: new Date()
            };
            m.status = 'Failed';
        }
    }

    /**
     * Record that a model was activated as a failover fallback.
     */
    recordFallbackActivation(provider) {
        const m = this.metrics[provider];
        if (m) {
            m.fallbackActivations++;
        }
    }

    /**
     * Record that the system had to resort to the local deterministic fallback.
     */
    recordLocalFallback() {
        this.metrics['Local Fallback'].activeCount++;
    }

    /**
     * Get the full raw metrics snapshot.
     */
    getTelemetry() {
        return this.metrics;
    }

    /**
     * Get a simplified key-value status mapping for the health dashboard.
     */
    getDashboardStatus() {
        return {
            'Gemini Direct': this.metrics['Gemini Direct'].status,
            'Gemini OpenRouter': this.metrics['Gemini OpenRouter'].status,
            'Llama 3 OpenRouter': this.metrics['Llama 3 OpenRouter'].status,
            'Qwen 2.5 OpenRouter': this.metrics['Qwen 2.5 OpenRouter'].status,
            'Local Fallback': this.metrics['Local Fallback'].activeCount
        };
    }
}

module.exports = new AITelemetryService();
