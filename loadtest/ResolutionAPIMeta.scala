import io.gatling.core.Predef._
import io.gatling.http.Predef._

import scala.concurrent.duration._

import java.util.Date._
import java.text.SimpleDateFormat._

import java.util.stream.Stream;
import java.util.function.Supplier;
import scala.util.Random

class ResolutionAPIMeta extends Simulation {
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

  // not sure if uppercase is supported as of Feb 3, 20223
  val domainNameFeeder = Iterator.continually {
    Map(
      "randomDomainName" -> s""
        .concat(
          adj(Random.nextInt(adj.length)).toString
            .concat(verb(Random.nextInt(verb.length)).toString)
            .concat(Random.nextInt(100000).toString)
            .concat(".")
            .concat(tld(Random.nextInt(tld.length)).toString)
        )
        .toLowerCase()
    )
  }

  // it just needs a big number, there is probably a better way to generate it
  val tokenIdFeeder = Iterator.continually {
    Map(
      "randomTokenId" -> s""
        .concat(
          Random.nextInt(1000000).toString
            .concat(Random.nextInt(1000000).toString)
            .concat(Random.nextInt(1000000).toString)
            .concat(Random.nextInt(1000000).toString)
            .concat(Random.nextInt(1000000).toString)
        )
    )
  }

  val resolutionGetRequests = exitBlockOnFail(
    feed(domainNameFeeder)
      .exec(
        http("1 /domains/randomDomainName")
          .get("/domains/${randomDomainName}")
          .headers(authHeaders)
          .header("randomDomainName", "/domains/${randomDomainName}")
      )
      .exec(
        http("2 /image-src/randomDomainName")
          .get("/image-src/${randomDomainName}")
          .headers(authHeaders)
          .header("randomDomainName", "${randomDomainName}")
      )
      .exec(
        http("3 /metadata/randomDomainName")
          .get("/metadata/${randomDomainName}")
          .headers(authHeaders)
          .header("randomDomainName", "${randomDomainName}")
      )
      .feed(tokenIdFeeder)
      .exec(
        http("4 /image-src/randomTokenId")
          .get("/image-src/${randomTokenId}")
          .headers(authHeaders)
          .header("randomTokenId", "${randomTokenId}")
      )
      .exec(
        http("5 /metadata/randomTokenId")
          .get("/metadata/${randomTokenId}")
          .headers(authHeaders)
          .header("randomTokenId", "${randomTokenId}")
      )
  );

  val scn = scenario("resolution tests")
    .during(duration seconds) {
      exec(resolutionGetRequests)
    }

  setUp(scn.inject(rampUsers(threads) during (rampup seconds)))
    .protocols(httpConf)
}