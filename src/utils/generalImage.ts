import {
  MetadataImageFontSize,
  UnstoppableDomainTld,
  UnstoppableDomainTlds,
} from '../types/common';

export const BackgroundColor = '4C47F7';
export const DeprecatedBackgroundColor = 'CCCCCC';
export const FontFamily =
  'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Ubuntu, Helvetica Neue, Oxygen, Cantarell, sans-serif';

const smallFontSizeTlds: UnstoppableDomainTld[] = [
  UnstoppableDomainTlds.Blockchain,
  UnstoppableDomainTlds.Unstoppable,
];

export function DefaultImageData(args: {
  label: string;
  tld: UnstoppableDomainTld;
  fontSize: MetadataImageFontSize;
}): string {
  const backgroundColorHash =
    args.tld === UnstoppableDomainTlds.Coin
      ? `#${DeprecatedBackgroundColor}`
      : `#${BackgroundColor}`;
  const tldStrokeHash =
    args.tld === UnstoppableDomainTlds.Coin ? '#999999' : '#2FE9FF';
  const labelX = smallFontSizeTlds.includes(args.tld) ? -26 : 0;
  const labelWidth = smallFontSizeTlds.includes(args.tld) ? 150 : 100;
  const label =
    args.label.length > 30
      ? args.label.substring(0, 29).concat('...')
      : args.label;
  const logoRayFillHash =
    args.tld === UnstoppableDomainTlds.Coin ? '#999999' : '#2FE9FF';

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="250" height="250" viewBox="0 0 250 250" version="1.1" fill="none">
    <title>Unstoppable Domains domain</title>
    <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
      <rect fill="${backgroundColorHash}" x="0" y="0" width="250" height="250"/>

      <g transform="translate(70.000000, 154.000000)">
        <g transform="translate(5.000000, 43.000000)">
          <rect x="${labelX}" y="0" width="${labelWidth}" height="34" stroke="${tldStrokeHash}" stroke-width="2.112px" rx="17" />
          <text  dominant-baseline="middle" text-anchor="middle" font-size="16" font-weight="bold" fill="#FFFFFF" font-family="${FontFamily}">
            <tspan x="19%" y="20">.${args.tld.toUpperCase()}</tspan>
          </text>
        </g>

        <text text-anchor="middle" font-family="${FontFamily}" font-size="${
    args.fontSize
  }" font-weight="bold" fill="#FFFFFF">
          <tspan x="22.5%" y="26">${label}</tspan>
        </text>
      </g>

      <g transform="translate(56.000000, 19.000000)">
        <polygon fill="${logoRayFillHash}" points="137.000268 2.12559903 137.000268 48.8887777 -2.72848394e-13 104.154352" />
        <path fill="#FFFFFF" d="M111.312718,-1.42108539e-14 L111.312718,80.7727631 C111.312718,104.251482 92.1448713,123.284744 68.5001341,123.284744 C44.855397,123.284744 25.6875503,104.251482 25.6875503,80.7727631 L25.6875503,46.7631786 L51.3751006,32.734225 L51.3751006,80.7727631 C51.3751006,88.9903146 58.0838469,95.6519563 66.3595049,95.6519563 C74.6351629,95.6519563 81.3439093,88.9903146 81.3439093,80.7727631 L81.3439093,16.3671125 L111.312718,-1.42108539e-14 Z" />
      </g>
    </g>
  </svg>`;
}
