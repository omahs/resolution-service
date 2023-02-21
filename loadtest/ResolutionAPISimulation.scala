import io.gatling.core.Predef._
import io.gatling.http.Predef._

import scala.concurrent.duration._

import java.util.Date._
import java.text.SimpleDateFormat._

import java.util.stream.Stream;
import java.util.function.Supplier;
import scala.util.Random

class ResolutionAPISimulation extends Simulation {
  val threads = Integer.getInteger("threads", 1)
  val rampup = java.lang.Long.getLong("rampup", 30L)
  val duration = java.lang.Long.getLong("duration", 300L)

  val AUTH_HEADER = System.getProperty("AUTH_HEADER").toString
  val X_PROXY_APIKEY = System.getProperty("X_PROXY_APIKEY").toString
  val BASE_URL = System.getProperty("BASE_URL").toString
  // val THROTTLE_PER_SEC = System.getProperty("THROTTLE_PER_SEC").toString

  println("using $ variable reference")
  val httpConf = http
    .baseUrl(
      BASE_URL
    )
    .acceptHeader("*/*")
    .acceptEncodingHeader("gzip, deflate")
    .acceptLanguageHeader("en-US,en;q=0.5")

  var nonAuthHeaders = Map[String, String](
    "Accept" -> "application/json"
  )

  println("setting authHeaders")
  var authHeaders = Map[String, String](
    "Accept" -> "application/json",
    "Authorization" -> "Bearer ".concat(AUTH_HEADER.toString),
    "X-Proxy-ApiKey" -> X_PROXY_APIKEY // fastly uac api key
  )

  println("setting authPostHeaders")
  var authPostHeaders = Map[String, String](
    "Accept" -> "application/json",
    "Content-Type" -> "application/json",
    "Authorization" -> "Bearer ".concat(AUTH_HEADER.toString),
    "X-Proxy-ApiKey" -> X_PROXY_APIKEY // fastly uac api key
  )

  println("".concat(authHeaders.toString))
  println("authHeaders are above")

  val hexChars = List('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a',
    'b', 'c', 'd', 'e', 'f')
  val addressFeeder = Iterator.continually {
    Map(
      "ownerAddress" -> s"0x${Random.alphanumeric.filter(hexChars.contains(_)).take(40).mkString}"
    )
  }

  val adj = List(
    "modest",
    "more",
    "multiethnic",
    "multiple",
    "national",
    "nationwide",
    "necessary",
    "new",
    "next",
    "nonclinical",
    "nonprobability",
    "nonrandom",
    "normal",
    "normative",
    "observed",
    "old",
    "online",
    "only",
    "optimal",
    "original",
    "other",
    "overall",
    "own",
    "particular",
    "patient",
    "perfect",
    "pooled",
    "poor",
    "positive",
    "possible",
    "powdered",
    "preceding",
    "prepared"
  )
  val verb = List(
    "Act",
    "Answer",
    "Approve",
    "Arrange",
    "Break",
    "Build",
    "Buy",
    "Coach",
    "Color",
    "Cough",
    "Create",
    "Complete",
    "Cry",
    "Dance",
    "Describe",
    "Draw",
    "Drink",
    "Eat",
    "Edit",
    "Enter",
    "Exit",
    "Imitate",
    "Invent",
    "Jump",
    "Laugh",
    "Lie",
    "Listen",
    "Paint",
    "Plan",
    "Play",
    "Read",
    "Replace",
    "Run",
    "Scream",
    "See",
    "Shop",
    "Shout",
    "Sing",
    "Skip",
    "Sleep",
    "Sneeze",
    "Solve",
    "Study",
    "Teach",
    "Touch",
    "Turn",
    "Walk",
    "Win"
  )

  val tld = List(
    "crypto",
    "nft",
    "wallet",
    "blockchain",
    "x",
    "bitcoin",
    "dao",
    "888",
    "zil"
  )

  var knownValidDomains = List(
    "henloo.x",
    "staging100.crypto",
    "staging102.crypto",
    "abc3.crypto",
    "sergii.crypto",
    "angrywolf.crypto",
    "udtestdev-bogdan-goerli-test.crypto"
  )

  var knownValidEthAddresses = List(
    "0x44d7d955eda6e2dfea1bd5093e99256408625ae4", // henloo.x
    "0xadcfc869b1ca9a8afabb9a696483aaed722928e6", // "staging100.crypto",
    "0xd96fc0f08e4f42482e740a1e6a7277e5780e552f", // "staging102.crypto",
    "0xd27d7d825abf89bc27773368516d5cddf3b3dc9c", // "abc3.crypto",
    "0x8c7fced0041f5620e3bc914a8cc79531e9d977cd", // "sergii.crypto"
    "0x815c5dab111f5a39e898e9ea0f20637edf427f65", // "angrywolf.crypto",
    "0xc2cc046e7f4f7a3e9715a853fc54907c12364b6b", // udtestdev-bogdan-goerli-test.crypto
    "0x8c7FcEd0041f5620e3Bc914a8cc79531e9D977CD", // unknown
    "0x44ff48128ffb31a9865b2d8737110e1dae247304", // unknown
    "0x4C863E316CE7A19BA23FDF801A369E1F3CC835AA", // unknown
    "0x22f88f4b4f7fdc46abb52fc5e43410520924f08d", // nick.blockchain
    "0xdfe0818ffc6af42c0a73952914246ad71e81e79c", // udtestdev-999.nft
    "0x537e2eb956aec859c99b3e5e28d8e45200c4fa52", // one.x
    "0x91aa2cce6b22ec9ecd8a56c830566e67187fe07e", // test-d-ud-xnliw.dao
    "0x00493aa44bcfd6f0c2ecc7f8b154e4fb352d1c81", // osa.crypto
    "0x0b8c171d43035e42ce82d813d917c3c8478a41ae" // guardian-02.wallet

  )

  // not sure if uppercase is supported as of Feb 3, 20223
  val domainNameFeeder = Iterator.continually {
    Map(
      "randomDomainName" -> s""
        .concat(
          adj(Random.nextInt(adj.length)).toString
            .concat(verb(Random.nextInt(verb.length)).toString)
            .concat(".")
            .concat(tld(Random.nextInt(tld.length)).toString)
        )
        .toLowerCase()
    )
  }

  val domainNameFeeder2 = Iterator.continually {
    Map(
      "randomDomainName2" -> s""
        .concat(
          adj(Random.nextInt(adj.length)).toString
            .concat(verb(Random.nextInt(verb.length)).toString)
            .concat(".")
            .concat(tld(Random.nextInt(tld.length)).toString)
        )
        .toLowerCase()
    )
  }
  val knownValidEthAddressFeeder = Iterator.continually {
    Map(
      "knownValidEthAddress" -> s""
        .concat(
          knownValidEthAddresses(
            Random.nextInt(knownValidEthAddresses.length)
          ).toString
        )
        .toLowerCase()
    )
  }

  val knownValidDomainFeeder = Iterator.continually {
    Map(
      "knownValidDomain" -> s""
        .concat(
          knownValidDomains(Random.nextInt(knownValidDomains.length)).toString
        )
        .toLowerCase()
    )
  }

  val randomTld = Iterator.continually {
    Map(
      "randomTld" -> s""
        .concat(tld(Random.nextInt(tld.length)).toString)
        .toLowerCase()
    )
  }

  val randomBulkAddressesFeed = Iterator.continually {
    val a = for (n <- 1 to Random.nextInt(250)) yield {
      val s =
        s"\"0x${Random.alphanumeric.filter(hexChars.contains(_)).take(40).mkString}\""
      s
    }

    // have to be careful with too many known addresses, as each address in the list must be unique
    val b = for (n <- 1 to Random.nextInt(3)) yield {
      val s2 =
        s"\"${knownValidEthAddresses(Random.nextInt(knownValidEthAddresses.length)).toString}\""
      s2
    }

    val newArray = a ++ b
    // println(newArray)
    Map(
      "randomBulkAddresses" -> newArray.mkString(", ")
    )
  }

  val bulkReverseResolution = exitBlockOnFail(
    exec(
      http("1c /status public no headers")
        .get("/status")
        .headers(authHeaders)
    )
      .feed(randomBulkAddressesFeed)
      .exec(
        http("2c /reverse/query randomBulkAddresses")
          .post("/reverse/query")
          .headers(authPostHeaders)
          .header("randomBulkAddresses", "${randomBulkAddresses}")
          .body(
            StringBody(
              """
          |{
          | "addresses": [ ${randomBulkAddresses} ]
          |}""".stripMargin
            )
          )
      )
  )

  val domainTlds = exitBlockOnFail(
    exec(
      http("1b /status public no headers")
        .get("/status")
        .headers(authHeaders)
    )
      .feed(randomTld)
      .exec(
        http("2b /domains?tlds=randomTld ")
          .get("/domains?${randomTld}")
          .headers(authHeaders)
          .header("randomTld$", "${randomTld}")
      )
  )

  val resolutionGetRequests = exitBlockOnFail(
    exec(
      http("1 /status public no headers")
        .get("/status")
        .headers(authHeaders)
    )
      .feed(domainNameFeeder)
      .exec(
        http("2 /domains/randomDomainName")
          .get("/domains/${randomDomainName}")
          .headers(authHeaders)
          .header("randomDomainName", "/domains/${randomDomainName}")
      )
      .feed(addressFeeder)
      .exec(
        http("3 /reverse/randomOwnerAddress")
          .get("/reverse/${ownerAddress}")
          .headers(authHeaders)
          .header("randomOwnerAddress", "${ownerAddress}")
      )
      .feed(knownValidDomainFeeder)
      .exec(
        http("5 /image-src/knownValidDomain")
          .get("/image-src/${knownValidDomain}")
          .headers(authHeaders)
          .header("knownValidDomain", "${knownValidDomain}")
      )
      .feed(knownValidEthAddressFeeder)
      .exec(
        http(
          "6 /domains?resolution%5Bcrypto.ETH.address%5D=knownValidEthAddress"
        )
          .get(
            "/domains?resolution%5Bcrypto.ETH.address%5D=${knownValidEthAddress}"
          )
          .headers(authHeaders)
          .header("knownValidEthAddress", "${knownValidEthAddress}")
      )
  );

  val scn = scenario("resolution tests")
    .during(duration seconds) {
      exec(resolutionGetRequests)
        .exec(domainTlds)
        .exec(bulkReverseResolution)
    }

  setUp(scn.inject(rampUsers(threads) during (rampup seconds)))
    .protocols(httpConf)
}
