import { Jwt } from '@credo-ts/core'
import { SigningAlgo } from '@sphereon/did-auth-siop'
import { cleanAll, enableNetConnect } from 'nock'

import { AskarModule } from '../../../../askar/src'
import { askarModuleConfig } from '../../../../askar/tests/helpers'
import { createAgentFromModules, type AgentType } from '../../../tests/utils'
import { universityDegreePresentationDefinition } from '../../../tests/utilsVp'
import { OpenId4VcVerifierModule } from '../OpenId4VcVerifierModule'

const modules = {
  openId4VcVerifier: new OpenId4VcVerifierModule({
    baseUrl: 'http://redirect-uri',
  }),
  askar: new AskarModule(askarModuleConfig),
}

describe('OpenId4VcVerifier', () => {
  let verifier: AgentType<typeof modules>

  beforeEach(async () => {
    verifier = await createAgentFromModules('verifier', modules, '96213c3d7fc8d4d6754c7a0fd969598f')
  })

  afterEach(async () => {
    await verifier.agent.shutdown()
    await verifier.agent.wallet.delete()
  })

  describe('Verification', () => {
    afterEach(() => {
      cleanAll()
      enableNetConnect()
    })

    it('check openid proof request format', async () => {
      const openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()
      const { authorizationRequestUri } = await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        requestSigner: {
          method: 'did',
          didUrl: verifier.kid,
        },
        verifierId: openIdVerifier.verifierId,
        presentationExchange: {
          definition: universityDegreePresentationDefinition,
        },
      })

      const base = `openid://?redirect_uri=http%3A%2F%2Fredirect-uri%2F${openIdVerifier.verifierId}%2Fauthorize&request=`
      expect(authorizationRequestUri.startsWith(base)).toBe(true)

      const _jwt = authorizationRequestUri.substring(base.length)
      const jwt = Jwt.fromSerializedJwt(_jwt)

      expect(jwt.header.kid).toEqual(verifier.kid)
      expect(jwt.header.alg).toEqual(SigningAlgo.EDDSA)
      expect(jwt.header.typ).toEqual('JWT')
      expect(jwt.payload.additionalClaims.scope).toEqual('openid')
      expect(jwt.payload.additionalClaims.client_id).toEqual(verifier.did)
      expect(jwt.payload.additionalClaims.redirect_uri).toEqual(
        `http://redirect-uri/${openIdVerifier.verifierId}/authorize`
      )
      expect(jwt.payload.additionalClaims.response_mode).toEqual('post')
      expect(jwt.payload.additionalClaims.nonce).toBeDefined()
      expect(jwt.payload.additionalClaims.state).toBeDefined()
      expect(jwt.payload.additionalClaims.response_type).toEqual('id_token vp_token')
      expect(jwt.payload.iss).toEqual(verifier.did)
      expect(jwt.payload.sub).toEqual(verifier.did)
    })
  })
})
