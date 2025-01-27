import type { AnonCredsClaimRecord } from './credential'
import type { W3cAnoncredsCredentialMetadata } from './metadata'
import type { AnonCredsCredentialInfo, AnonCredsSchema } from '../models'
import type { AnonCredsCredentialRecord } from '../repository'
import type { StoreCredentialOptions } from '../services'
import type { DefaultW3cCredentialTags } from '@credo-ts/core'

import { CredoError, W3cCredentialRecord, utils } from '@credo-ts/core'

import { mapAttributeRawValuesToAnonCredsCredentialValues } from './credential'
import {
  getQualifiedDidIndyCredentialDefinition,
  getQualifiedDidIndyDid,
  getQualifiedDidIndyRevocationRegistryDefinition,
  getQualifiedDidIndySchema,
  isUnqualifiedDidIndyCredentialDefinition,
  isUnqualifiedDidIndyRevocationRegistryDefinition,
  isUnqualifiedDidIndySchema,
  isUnqualifiedCredentialDefinitionId,
  isUnqualifiedRevocationRegistryId,
  isIndyDid,
  getUnQualifiedDidIndyDid,
} from './indyIdentifiers'
import { W3cAnonCredsCredentialMetadataKey } from './metadata'

export type AnonCredsCredentialTags = {
  anonCredsLinkSecretId: string
  anonCredsCredentialRevocationId?: string
  anonCredsMethodName: string

  // the following keys can be used for every `attribute name` in credential.
  [key: `anonCredsAttr::${string}::marker`]: true | undefined
  [key: `anonCredsAttr::${string}::value`]: string | undefined

  anonCredsSchemaName: string
  anonCredsSchemaVersion: string

  anonCredsSchemaId: string
  anonCredsSchemaIssuerId: string
  anonCredsCredentialDefinitionId: string
  anonCredsRevocationRegistryId?: string

  anonCredsUnqualifiedIssuerId?: string
  anonCredsUnqualifiedSchemaId?: string
  anonCredsUnqualifiedSchemaIssuerId?: string
  anonCredsUnqualifiedCredentialDefinitionId?: string
  anonCredsUnqualifiedRevocationRegistryId?: string
}

function anoncredsCredentialInfoFromW3cRecord(w3cCredentialRecord: W3cCredentialRecord): AnonCredsCredentialInfo {
  if (Array.isArray(w3cCredentialRecord.credential.credentialSubject)) {
    throw new CredoError('Credential subject must be an object, not an array.')
  }

  const anonCredsTags = getAnonCredsTagsFromRecord(w3cCredentialRecord)
  if (!anonCredsTags) throw new CredoError('AnonCreds tags not found on credential record.')

  const anoncredsCredentialMetadata = w3cCredentialRecord.metadata.get<W3cAnoncredsCredentialMetadata>(
    W3cAnonCredsCredentialMetadataKey
  )
  if (!anoncredsCredentialMetadata) throw new CredoError('AnonCreds metadata not found on credential record.')

  return {
    attributes: (w3cCredentialRecord.credential.credentialSubject.claims as AnonCredsClaimRecord) ?? {},
    credentialId: anoncredsCredentialMetadata.credentialId,
    credentialDefinitionId: anonCredsTags.anonCredsCredentialDefinitionId,
    schemaId: anonCredsTags.anonCredsSchemaId,
    credentialRevocationId: anoncredsCredentialMetadata.credentialRevocationId ?? null,
    revocationRegistryId: anonCredsTags.anonCredsRevocationRegistryId ?? null,
    methodName: anoncredsCredentialMetadata.methodName,
    linkSecretId: anoncredsCredentialMetadata.linkSecretId,
  }
}

function anoncredsCredentialInfoFromAnoncredsRecord(
  anonCredsCredentialRecord: AnonCredsCredentialRecord
): AnonCredsCredentialInfo {
  const attributes: { [key: string]: string } = {}
  for (const attribute in anonCredsCredentialRecord.credential) {
    attributes[attribute] = anonCredsCredentialRecord.credential.values[attribute].raw
  }

  return {
    attributes,
    credentialDefinitionId: anonCredsCredentialRecord.credential.cred_def_id,
    credentialId: anonCredsCredentialRecord.credentialId,
    schemaId: anonCredsCredentialRecord.credential.schema_id,
    credentialRevocationId: anonCredsCredentialRecord.credentialRevocationId ?? null,
    revocationRegistryId: anonCredsCredentialRecord.credential.rev_reg_id ?? null,
    methodName: anonCredsCredentialRecord.methodName,
    linkSecretId: anonCredsCredentialRecord.linkSecretId,
  }
}

export function getAnoncredsCredentialInfoFromRecord(
  credentialRecord: W3cCredentialRecord | AnonCredsCredentialRecord
): AnonCredsCredentialInfo {
  if (credentialRecord instanceof W3cCredentialRecord) {
    return anoncredsCredentialInfoFromW3cRecord(credentialRecord)
  } else {
    return anoncredsCredentialInfoFromAnoncredsRecord(credentialRecord)
  }
}
export function getAnonCredsTagsFromRecord(record: W3cCredentialRecord) {
  const anoncredsMetadata = record.metadata.get<W3cAnoncredsCredentialMetadata>(W3cAnonCredsCredentialMetadataKey)
  if (!anoncredsMetadata) return undefined

  const tags = record.getTags() as DefaultW3cCredentialTags & Partial<AnonCredsCredentialTags>
  if (
    !tags.anonCredsLinkSecretId ||
    !tags.anonCredsMethodName ||
    !tags.anonCredsSchemaId ||
    !tags.anonCredsSchemaName ||
    !tags.anonCredsSchemaVersion ||
    !tags.anonCredsSchemaIssuerId ||
    !tags.anonCredsCredentialDefinitionId
  ) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(tags).filter(([key]) => key.startsWith('anonCreds'))
  ) as AnonCredsCredentialTags
}

export function getStoreCredentialOptions(
  options: StoreCredentialOptions,
  indyNamespace?: string
): StoreCredentialOptions {
  const {
    credentialRequestMetadata,
    credentialDefinitionId,
    schema,
    credential,
    credentialDefinition,
    revocationRegistry,
  } = options

  const storeCredentialOptions = {
    credentialId: utils.uuid(),
    credentialRequestMetadata,
    credential,
    credentialDefinitionId: isUnqualifiedCredentialDefinitionId(credentialDefinitionId)
      ? getQualifiedDidIndyDid(credentialDefinitionId, indyNamespace as string)
      : credentialDefinitionId,
    credentialDefinition: isUnqualifiedDidIndyCredentialDefinition(credentialDefinition)
      ? getQualifiedDidIndyCredentialDefinition(credentialDefinition, indyNamespace as string)
      : credentialDefinition,
    schema: isUnqualifiedDidIndySchema(schema) ? getQualifiedDidIndySchema(schema, indyNamespace as string) : schema,
    revocationRegistry: revocationRegistry?.definition
      ? {
          definition: isUnqualifiedDidIndyRevocationRegistryDefinition(revocationRegistry.definition)
            ? getQualifiedDidIndyRevocationRegistryDefinition(revocationRegistry.definition, indyNamespace as string)
            : revocationRegistry.definition,
          id: isUnqualifiedRevocationRegistryId(revocationRegistry.id)
            ? getQualifiedDidIndyDid(revocationRegistry.id, indyNamespace as string)
            : revocationRegistry.id,
        }
      : undefined,
  }

  return storeCredentialOptions
}

export function getW3cRecordAnonCredsTags(options: {
  w3cCredentialRecord: W3cCredentialRecord
  schemaId: string
  schema: Omit<AnonCredsSchema, 'attrNames'>
  credentialDefinitionId: string
  revocationRegistryId?: string
  credentialRevocationId?: string
  linkSecretId: string
  methodName: string
}) {
  const {
    w3cCredentialRecord,
    schema,
    schemaId,
    credentialDefinitionId,
    revocationRegistryId,
    credentialRevocationId,
    linkSecretId,
    methodName,
  } = options

  const issuerId = w3cCredentialRecord.credential.issuerId

  const anonCredsCredentialRecordTags: AnonCredsCredentialTags = {
    anonCredsLinkSecretId: linkSecretId,
    anonCredsCredentialDefinitionId: credentialDefinitionId,
    anonCredsSchemaId: schemaId,
    anonCredsSchemaName: schema.name,
    anonCredsSchemaIssuerId: schema.issuerId,
    anonCredsSchemaVersion: schema.version,
    anonCredsMethodName: methodName,
    anonCredsRevocationRegistryId: revocationRegistryId,
    anonCredsCredentialRevocationId: credentialRevocationId,
    ...(isIndyDid(issuerId) && {
      anonCredsUnqualifiedIssuerId: getUnQualifiedDidIndyDid(issuerId),
      anonCredsUnqualifiedCredentialDefinitionId: getUnQualifiedDidIndyDid(credentialDefinitionId),
      anonCredsUnqualifiedSchemaId: getUnQualifiedDidIndyDid(schemaId),
      anonCredsUnqualifiedSchemaIssuerId: getUnQualifiedDidIndyDid(schema.issuerId),
      anonCredsUnqualifiedRevocationRegistryId: revocationRegistryId
        ? getUnQualifiedDidIndyDid(revocationRegistryId)
        : undefined,
    }),
  }

  if (Array.isArray(w3cCredentialRecord.credential.credentialSubject)) {
    throw new CredoError('Credential subject must be an object, not an array.')
  }

  const values = mapAttributeRawValuesToAnonCredsCredentialValues(
    (w3cCredentialRecord.credential.credentialSubject.claims as AnonCredsClaimRecord) ?? {}
  )

  for (const [key, value] of Object.entries(values)) {
    anonCredsCredentialRecordTags[`anonCredsAttr::${key}::value`] = value.raw
    anonCredsCredentialRecordTags[`anonCredsAttr::${key}::marker`] = true
  }

  return anonCredsCredentialRecordTags
}
