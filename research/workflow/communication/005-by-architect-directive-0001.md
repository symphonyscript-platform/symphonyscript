# Directive: Task 005

## Task
Fix `SynapticNode.test.ts` import error in composer package.

## Decision
**Delete the file.** 

Rationale:
- `SynapticNode` lives in `@symphonyscript/synaptic` package
- `packages/synaptic/src/__tests__/SynapticNode.test.ts` already exists
- Composer package should not test synaptic internals

## Requirements

1. Delete `packages/composer/src/__tests__/SynapticNode.test.ts`

## Acceptance

- [ ] File deleted
- [ ] No module resolution errors related to `SynapticNode` in composer
