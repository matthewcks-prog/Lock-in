/**
 * Authentication Services - Module Barrel Export
 *
 * This module exports all authentication-related services.
 * Following the Single Responsibility Principle, each service has one clear purpose.
 *
 * Architecture:
 * - JwtVerificationService: Orchestrates JWT verification using Strategy Pattern
 * - JwksProvider: Fetches and caches JWKS (JSON Web Key Sets)
 * - Strategies: Pluggable verification strategies (ES256, HS256, Supabase SDK)
 *
 * @module services/auth
 */

const { JwtVerificationService } = require('./jwtVerificationService');
const { JwksProvider } = require('./jwksProvider');
const { createJwtVerifierForConfig } = require('./jwtVerifierFactory');
const {
  JwksVerifierStrategy,
  SymmetricVerifierStrategy,
  SupabaseSdkVerifierStrategy,
} = require('./strategies');

module.exports = {
  JwtVerificationService,
  JwksProvider,
  createJwtVerifierForConfig,
  // Strategies (for testing and custom configurations)
  JwksVerifierStrategy,
  SymmetricVerifierStrategy,
  SupabaseSdkVerifierStrategy,
};
