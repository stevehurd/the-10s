import { NextResponse } from 'next/server'

import { DraftRuleError } from './service'

export function draftErrorResponse(error: unknown) {
  if (error instanceof DraftRuleError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }

  console.error('Draft operation failed:', error)
  return NextResponse.json({ error: 'Draft operation failed' }, { status: 500 })
}
