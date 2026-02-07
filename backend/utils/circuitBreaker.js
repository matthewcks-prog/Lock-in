class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.openDurationMs = options.openDurationMs ?? 30000;
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts ?? 1;
    this._now = options.now ?? (() => Date.now());
    this._store = options.store ?? null;
    this._states = this._store ? null : new Map();
  }

  async _getState(provider) {
    if (this._store) {
      const stored = await this._store.get(provider);
      if (stored) {
        return stored;
      }
    }

    if (this._states && !this._states.has(provider)) {
      this._states.set(provider, {
        state: 'closed',
        failures: 0,
        openedAt: null,
        halfOpenAttempts: 0,
      });
    }
    return this._states
      ? this._states.get(provider)
      : {
          state: 'closed',
          failures: 0,
          openedAt: null,
          halfOpenAttempts: 0,
        };
  }

  async _setState(provider, state) {
    if (this._store) {
      await this._store.set(provider, state);
      return;
    }
    if (this._states) {
      this._states.set(provider, state);
    }
  }

  async canRequest(provider) {
    const state = await this._getState(provider);
    if (state.state === 'open') {
      const elapsed = this._now() - state.openedAt;
      if (elapsed >= this.openDurationMs) {
        state.state = 'half_open';
        state.halfOpenAttempts = 0;
        await this._setState(provider, state);
      } else {
        return {
          allowed: false,
          state: 'open',
          retryAfterMs: Math.max(0, this.openDurationMs - elapsed),
        };
      }
    }

    if (state.state === 'half_open') {
      if (state.halfOpenAttempts >= this.halfOpenMaxAttempts) {
        return { allowed: false, state: 'half_open', retryAfterMs: this.openDurationMs };
      }
      state.halfOpenAttempts += 1;
      await this._setState(provider, state);
      return { allowed: true, state: 'half_open', retryAfterMs: 0 };
    }

    return { allowed: true, state: 'closed', retryAfterMs: 0 };
  }

  async recordSuccess(provider) {
    const state = await this._getState(provider);
    state.state = 'closed';
    state.failures = 0;
    state.openedAt = null;
    state.halfOpenAttempts = 0;
    await this._setState(provider, state);
    return { state: state.state, failures: state.failures };
  }

  async recordFailure(provider) {
    const state = await this._getState(provider);
    state.failures += 1;
    if (state.failures >= this.failureThreshold) {
      state.state = 'open';
      state.openedAt = this._now();
      state.halfOpenAttempts = 0;
      await this._setState(provider, state);
      return { state: state.state, failures: state.failures, opened: true };
    }
    await this._setState(provider, state);
    return { state: state.state, failures: state.failures, opened: false };
  }

  async getState(provider) {
    const state = await this._getState(provider);
    return { ...state };
  }

  async reset(provider) {
    if (provider) {
      if (this._store) {
        await this._store.delete(provider);
      }
      if (this._states) {
        this._states.delete(provider);
      }
      return;
    }
    if (this._store) {
      await this._store.clear();
    }
    if (this._states) {
      this._states.clear();
    }
  }
}

module.exports = {
  CircuitBreaker,
};
