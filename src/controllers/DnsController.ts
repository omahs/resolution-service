import {
  Get,
  Controller,
  QueryParams,
  ContentType,
  Post,
  Res,
} from 'routing-controllers';
import { Response } from 'express';
import { DnsQuery } from './dto/Dns';
import { base64DecodeURL } from '../utils/common';
import { determineDomainNameFromHex } from '../utils/domain';
import { Domain } from '../models';
import { env } from '../env';

@Controller()
export class DnsController {
  @ContentType('application/dns-message')
  @Get('/dns-query')
  async getDnsQuery(@Res() res: Response, @QueryParams() query: DnsQuery) {
    // transcribe the dns query from hex to something meaningful.
    // decimal representation of hex digits of the dns query.
    const dnsQuery: Uint8Array = base64DecodeURL(query.dns);
    const END_OF_HEADER_OCTET = 12;
    const START_OF_HEADER_OCTET = 0;
    const START_OF_QTYPE_SECTION = dnsQuery.length - 4;
    const START_OF_QCLASS_SECTION = dnsQuery.length - 4;
    const header = dnsQuery.subarray(
      START_OF_HEADER_OCTET,
      END_OF_HEADER_OCTET,
    );
    // verifyHeader

    const qname = dnsQuery.subarray(
      END_OF_HEADER_OCTET,
      START_OF_QTYPE_SECTION,
    );
    const domainName = determineDomainNameFromHex(qname);
    const qtype = dnsQuery.subarray(
      START_OF_QTYPE_SECTION,
      START_OF_QCLASS_SECTION,
    );
    const qclass = dnsQuery.subarray(START_OF_QCLASS_SECTION, dnsQuery.length);

    // fetch from resolution.
    const domain = await Domain.findOne({
      where: { name: 'matt.crypto' },
      relations: ['resolutions', 'reverseResolutions'],
      cache: env.CACHE.IN_MEMORY_CACHE_EXPIRATION_TIME,
    });

    /*
      udtestdev-dns-ipfs.crypto => 

      'dns.A': '["10.0.0.1","10.0.0.2"]',
      'dns.ttl': '1000',
      'dns.A.ttl': '1800',
      'dns.CNAME': '',
      'dns.CNAME.ttl': '',
      'dweb.ipfs.hash': 'QmVJ26hBrwwNAPVmLavEFXDUunNDXeFSeMPmHuPxKe6dJv',
      'ipfs.html.value': '',
      'browser.redirect_url': '',
      'ipfs.redirect_domain.value': '',
      'browser.preferred_protocols': '["ipfs","https","http"]'
    */
  }

  // @ContentType('application/dns-message')
  // @Post('/dns-query')
  // async getDnsQuery(
  //   @QueryParams() query: DnsQuery,
  // ): Promise<DnsQueryResponse> {

  // }
}
