# load testing
Resolution service has tests define here via scala, and manually defined tests in [flood.io](https://app.flood.io/projects/99157/streams). Specifically this [stream](https://app.flood.io/projects/99157/streams/199451/design)

## how to run locally
1. follow the [gatling instructions](https://gatling.io/docs/gatling/tutorials/installation/) to install gatling
1. export JAVA_OPTS to set system properties for API keys
`export JAVA_OPTS="-DAUTH_HEADER=VALID_BEARER_TOKEN -DX_PROXY_APIKEY=VALID_UAC_API_KEY -DBASE_URL=VALID_BASE_URL`
    1. `AUTH_HEADER` is the RAP Bearer token value. Used to set the `Authorization` header.  `Bearer ` will be used as a prefix to this value
    1. `X_PROXY_API_KEY` will be used to set the `X-Proxy-ApiKey` header. This is used to bypass Fastly UAC for testing against Unstoppable Domains services
1. execute gatling `gatling --run-mode local -sf /path/to/<repo>/loadtest -s SCALA_FILENAME`



### modifications
for those unfamiliar with scala/gatling, see [gatling.io](https://gatling.io/docs/)