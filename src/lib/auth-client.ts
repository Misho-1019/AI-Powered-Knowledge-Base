'use client'

import { createAuthClient } from 'better-auth/react'

/**
 * Browser-side auth client. No baseURL: it defaults to the current origin,
 * which is correct for both localhost and the deployed app.
 */
export const authClient = createAuthClient()
