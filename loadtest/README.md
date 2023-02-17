# load testing
Resolution service has tests define here via scala, and manually defined tests in [flood.io](https://app.flood.io/projects/99157/streams). Specifically this [stream](https://app.flood.io/projects/99157/streams/199451/design)

## how to run locally
1. follow the [gatling instructions](https://gatling.io/docs/gatling/tutorials/installation/) to install gatling
1. export JAVA_OPTS to set system properties for API keys
`export JAVA_OPTS="-DAUTH_HEADER=VALID_BEARER_TOKEN -DX_PROXY_APIKEY=VALID_UAC_API_KEY -DBASE_URL=htps://api.ud-staging.com/resolve`
    1. `AUTH_HEADER` is the RAP Bearer token value. Used to set the `Authorization` header.  `Bearer ` will be used as a prefix to this value
    1. `X_PROXY_API_KEY` will be used to set the `X-Proxy-ApiKey` header. This is used to bypass Fastly UAC for api.ud-sandbox.com and/or api.ud-staging.com
1. execute gatling `gatling --run-mode local -sf /path/to/<repo>/loadtest -s SCALE_FILENAME`



### modifications
for those unfamiliar with scala/gatling, see [gatling.io](https://gatling.io/docs/)


## how to run via flood.io
1. review the `.scale` file 
1. create new stream in [flood.io](https://app.flood.io/) (select your project, Streams, new stream; or update an existing stream)
1. Set Advanced/Optional parameters using `-D` syntax similar to setting `JAVA_OPTS` when running locally
1. in [flood.io](https://app.flood.io/) select the project & stream you created, go to launch tab, set load test parameters, and `Launch Test`

each test execution in flood.io is called a 'flood'

[example flood](https://app.flood.io/projects/99747/flood/2LNd1UszwdAJvHVP7zeeZUXp8fQ/grid/jOKjAif7R1iWMlhMA8081g/timeline/2023-02-06T20:32:30.000Z/2023-02-06T20:36:15.000Z?label=domainsExpandRecords4) in [flood.io](https://flood.io)

## Demo
see this series of [loom videos](https://loom.com/share/folder/2e5e6b2b9d0f42b09e857cca68ea8c00) for these tests in use with both flood.io and locally via gatling
