import { expect } from 'chai';
import { Domain } from '../../models';
import createSVGfromTemplate, {
  simpleSVGTemplate,
  offChainSVGTemplate,
  createOverlayText,
  determineShortLabel,
} from './svgTemplate';

describe('svgTemplates', () => {
  describe('determineShortLabel', () => {
    it('should return empty string when not above 40 characters', () => {
      const shortLabel = determineShortLabel('test');
      expect(shortLabel).to.be.equal('');
    });
    it('should return shortened label when above 40 characters', () => {
      const shortLabel = determineShortLabel(
        'veryLongLabelWithMoreThanFortyCharactersTest',
      );
      expect(shortLabel).to.be.equal(
        'veryLongLabelWithMoreThanFortyCharact...',
      );
    });
  });

  describe('createOverlayText', () => {
    it('should create the correct over lay text template', () => {
      const overLayTemplate = createOverlayText(10, 'test', 'crypto');
      expect(overLayTemplate.replace(/\s+/g, '')).to.be.equal(
        `
      <text 
        x="35"
        y="430"
        font-size="10px"
        font-weight="bold"
        fill="#FFFFFF"
        font-family="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Ubuntu, Helvetica Neue, Oxygen, Cantarell, sans-serif"
      >
        test
      </text>
      <text
        x="35"
        y="480"
        font-size="40px"
        fill="#FFFFFF"
        weight="400"
        font-family="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Ubuntu, Helvetica Neue, Oxygen, Cantarell, sans-serif"
      >
        .crypto
      </text>
    `.replace(/\s+/g, ''),
      );
    });
  });

  describe('simpleSVGTemplate', () => {
    it('should create the correct a simple svg template', () => {
      const simpleTemplate = simpleSVGTemplate('test.crypto');
      expect(simpleTemplate.replace(/\s+/g, '')).to.be.equal(
        `
      <svg
        width="512"
        height="512"
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <image href="test.crypto" width="512" height="512" preserveAspectRatio="none"/>
      </svg>
    `.replace(/\s+/g, ''),
      );
    });
  });

  describe('offChainSVGTemplate', () => {
    it('should create an off chain svg template', () => {
      const domain = new Domain({ name: 'test.crypto' });
      const offchainTemplate = offChainSVGTemplate(
        'test.crypto',
        'test',
        domain,
        10,
      );
      expect(offchainTemplate.replace(/\s+/g, '')).to.be.equal(
        `<svgwidth="512"height="512"viewBox="00512512"fill="none"xmlns="http://www.w3.org/2000/svg"><defs><patternid="backImg"patternUnits="userSpaceOnUse"x="0"y="0"width="512"height="512"><imagewidth="512"height="512"preserveAspectRatio="none"href="data:test;base64,test.crypto"/></pattern><filterid="shadowy"><feDiffuseLightingin="SourceGraphic"result="light"lighting-color="white"><feDistantLightazimuth="240"elevation="40"/></feDiffuseLighting><feCompositein="SourceGraphic"in2="light"operator="arithmetic"k1="1"k2="0"k3="0"k4="0"/></filter></defs><rectwidth="512"height="512"fill="url(#backImg)"filter="url(#shadowy)"/><gtransform="scale(1.75)translate(18,21)"><pathxmlns="http://www.w3.org/2000/svg"d="M0.66668745.3895L0.67035445.3867L0.67768745.3812L0.66668745.3895L0.6877745.3739L11.751137.0512C11.695336.466511.666735.873911.666735.2746V20.5619L22.666714.493V28.8378L35.519.1826V7.41249L48.33330.332031V9.52651L59.33331.25157V3.09065L48.333311.0208V12.515L59.33334.92973V6.76881L48.333314.0093V15.5035L59.33338.60789V10.447L48.333316.9978V18.493L59.333312.2861V14.1251L48.333319.9872V21.4805L59.333315.9642V17.8033L48.333322.9748V24.469L59.333319.6424V21.4815L48.333325.9633V35.2746C48.333345.431540.125253.66543053.6654C21.717253.665414.717348.155412.444140.59L0.6740245.3858L0.66668745.3895ZM12.261139.9372L0.68135445.3812L0.6767745.384L12.348940.262C12.318640.154112.289440.045812.261139.9372ZM11.868838.0148L0.6877745.3739L0.67768745.3812L11.919438.3348C11.901638.228411.884738.121711.868838.0148ZM12.105939.2941L0.6960245.3739L12.180239.6146C12.154539.508212.129739.401312.105939.2941ZM11.784837.3735L0.7015245.3647L11.82437.6947C11.8137.587911.796937.480811.784837.3735ZM35.531.1936L22.761836.3851C23.286439.410825.917141.711329.083441.7113C32.627241.711335.538.829535.535.2746V31.1936ZM35.529.0088L22.666735.0438V35.2746C22.666735.426522.671935.577122.682235.7264L35.530.1012V29.0088ZM35.526.8267L22.666733.6654V34.3541L35.527.9173V26.8267ZM35.524.641L22.666732.2851V32.9757L35.525.7343V24.641ZM35.522.4571L22.666730.9058V31.5955L35.523.5495V22.4571ZM35.520.2741L22.666729.5274V30.2162L35.521.3656V20.2741ZM0.6767745.384L0.6740245.3858L0.68135445.3812L12.037738.9736C12.01638.867211.995238.760411.975438.6533L0.67768745.3812L0.6740245.3858L0.67035445.3867L0.6767745.384Z"fill="white"/></g><gtransform="scale(1.75)translate(250,21)"><pathxmlns="http://www.w3.org/2000/svg"d="M2211L19.568.21L19.94.52L16.293.7L14.40.5L111.96L7.60.5L5.713.69L2.14.5L2.448.2L011L2.4413.79L2.117.49L5.7118.31L7.621.5L1120.03L14.421.49L16.2918.3L19.917.48L19.5613.79L2211ZM9.0915.72L5.2911.91L6.7710.43L9.0912.76L14.946.89L16.428.37L9.0915.72Z"fill="white"/></g><textx="35"y="430"font-size="10px"font-weight="bold"fill="#FFFFFF"font-family="system-ui,-apple-system,BlinkMacSystemFont,SegoeUI,Roboto,Ubuntu,HelveticaNeue,Oxygen,Cantarell,sans-serif">test</text><textx="35"y="480"font-size="40px"fill="#FFFFFF"weight="400"font-family="system-ui,-apple-system,BlinkMacSystemFont,SegoeUI,Roboto,Ubuntu,HelveticaNeue,Oxygen,Cantarell,sans-serif">.crypto</text></svg>`,
      );
    });
  });

  describe('createSVGfromTemplate', () => {
    it('should create a svg template', () => {
      const defaultTemplate = createSVGfromTemplate({
        background_color: '',
        background_image: 'test',
        domain: 'test.crypto',
        fontSize: 10,
      });

      expect(defaultTemplate.replace(/\s+/g, '')).to.be.equal(
        `
      <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="backImg" patternUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          
          <image href="data:undefined;base64,test" width="512" height="512" />
        </pattern>
        
  <filter id="shadowy">
    <feDiffuseLighting in="SourceGraphic" result="light" lighting-color="white"> <feDistantLight azimuth="240" elevation="40"/>
    </feDiffuseLighting>
  <feComposite in="SourceGraphic" in2="light" operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/>
  </filter>
  
      </defs>
      
  <rect width="512" height="512" fill="url(#backImg)" filter="url(#shadowy)"/>
  <g transform="scale(1.75) translate(18,21)">
    <path xmlns="http://www.w3.org/2000/svg" d="M0.666687 45.3895L0.670354 45.3867L0.677687 45.3812L0.666687 45.3895L0.68777 45.3739L11.7511 37.0512C11.6953 36.4665 11.6667 35.8739 11.6667 35.2746V20.5619L22.6667 14.493V28.8378L35.5 19.1826V7.41249L48.3333 0.332031V9.52651L59.3333 1.25157V3.09065L48.3333 11.0208V12.515L59.3333 4.92973V6.76881L48.3333 14.0093V15.5035L59.3333 8.60789V10.447L48.3333 16.9978V18.493L59.3333 12.2861V14.1251L48.3333 19.9872V21.4805L59.3333 15.9642V17.8033L48.3333 22.9748V24.469L59.3333 19.6424V21.4815L48.3333 25.9633V35.2746C48.3333 45.4315 40.1252 53.6654 30 53.6654C21.7172 53.6654 14.7173 48.1554 12.4441 40.59L0.67402 45.3858L0.666687 45.3895ZM12.2611 39.9372L0.681354 45.3812L0.67677 45.384L12.3489 40.262C12.3186 40.1541 12.2894 40.0458 12.2611 39.9372ZM11.8688 38.0148L0.68777 45.3739L0.677687 45.3812L11.9194 38.3348C11.9016 38.2284 11.8847 38.1217 11.8688 38.0148ZM12.1059 39.2941L0.69602 45.3739L12.1802 39.6146C12.1545 39.5082 12.1297 39.4013 12.1059 39.2941ZM11.7848 37.3735L0.70152 45.3647L11.824 37.6947C11.81 37.5879 11.7969 37.4808 11.7848 37.3735ZM35.5 31.1936L22.7618 36.3851C23.2864 39.4108 25.9171 41.7113 29.0834 41.7113C32.6272 41.7113 35.5 38.8295 35.5 35.2746V31.1936ZM35.5 29.0088L22.6667 35.0438V35.2746C22.6667 35.4265 22.6719 35.5771 22.6822 35.7264L35.5 30.1012V29.0088ZM35.5 26.8267L22.6667 33.6654V34.3541L35.5 27.9173V26.8267ZM35.5 24.641L22.6667 32.2851V32.9757L35.5 25.7343V24.641ZM35.5 22.4571L22.6667 30.9058V31.5955L35.5 23.5495V22.4571ZM35.5 20.2741L22.6667 29.5274V30.2162L35.5 21.3656V20.2741ZM0.67677 45.384L0.67402 45.3858L0.681354 45.3812L12.0377 38.9736C12.016 38.8672 11.9952 38.7604 11.9754 38.6533L0.677687 45.3812L0.67402 45.3858L0.670354 45.3867L0.67677 45.384Z" fill="white"/>
  </g>
  <g transform="scale(1.75) translate(250, 21)">
    <path xmlns="http://www.w3.org/2000/svg" d="M22 11L19.56 8.21L19.9 4.52L16.29 3.7L14.4 0.5L11 1.96L7.6 0.5L5.71 3.69L2.1 4.5L2.44 8.2L0 11L2.44 13.79L2.1 17.49L5.71 18.31L7.6 21.5L11 20.03L14.4 21.49L16.29 18.3L19.9 17.48L19.56 13.79L22 11ZM9.09 15.72L5.29 11.91L6.77 10.43L9.09 12.76L14.94 6.89L16.42 8.37L9.09 15.72Z" fill="white"/>
  </g>
  
      
    <text 
      x="35"
      y="430"
      font-size="10px"
      font-weight="bold"
      fill="#FFFFFF"
      font-family="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Ubuntu, Helvetica Neue, Oxygen, Cantarell, sans-serif"
    >
      test
    </text>
    <text
      x="35"
      y="480"
      font-size="40px"
      fill="#FFFFFF"
      weight="400"
      font-family="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Ubuntu, Helvetica Neue, Oxygen, Cantarell, sans-serif"
    >
      .crypto
    </text>
  
    </svg>
    `.replace(/\s+/g, ''),
      );
    });

    it('should create a svg template for subdomain', () => {
      const defaultTemplate = createSVGfromTemplate({
        background_color: '',
        background_image: 'test',
        domain: 'test.domain.crypto',
        fontSize: 10,
      });

      expect(defaultTemplate.replace(/\s+/g, '')).to.be.equal(
        `
      <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="backImg" patternUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          
          <image href="data:undefined;base64,test" width="512" height="512" />
        </pattern>
        
  <filter id="shadowy">
    <feDiffuseLighting in="SourceGraphic" result="light" lighting-color="white"> <feDistantLight azimuth="240" elevation="40"/>
    </feDiffuseLighting>
  <feComposite in="SourceGraphic" in2="light" operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/>
  </filter>
  
      </defs>
      
  <rect width="512" height="512" fill="url(#backImg)" filter="url(#shadowy)"/>
  <g transform="scale(1.75) translate(18,21)">
    <path xmlns="http://www.w3.org/2000/svg" d="M0.666687 45.3895L0.670354 45.3867L0.677687 45.3812L0.666687 45.3895L0.68777 45.3739L11.7511 37.0512C11.6953 36.4665 11.6667 35.8739 11.6667 35.2746V20.5619L22.6667 14.493V28.8378L35.5 19.1826V7.41249L48.3333 0.332031V9.52651L59.3333 1.25157V3.09065L48.3333 11.0208V12.515L59.3333 4.92973V6.76881L48.3333 14.0093V15.5035L59.3333 8.60789V10.447L48.3333 16.9978V18.493L59.3333 12.2861V14.1251L48.3333 19.9872V21.4805L59.3333 15.9642V17.8033L48.3333 22.9748V24.469L59.3333 19.6424V21.4815L48.3333 25.9633V35.2746C48.3333 45.4315 40.1252 53.6654 30 53.6654C21.7172 53.6654 14.7173 48.1554 12.4441 40.59L0.67402 45.3858L0.666687 45.3895ZM12.2611 39.9372L0.681354 45.3812L0.67677 45.384L12.3489 40.262C12.3186 40.1541 12.2894 40.0458 12.2611 39.9372ZM11.8688 38.0148L0.68777 45.3739L0.677687 45.3812L11.9194 38.3348C11.9016 38.2284 11.8847 38.1217 11.8688 38.0148ZM12.1059 39.2941L0.69602 45.3739L12.1802 39.6146C12.1545 39.5082 12.1297 39.4013 12.1059 39.2941ZM11.7848 37.3735L0.70152 45.3647L11.824 37.6947C11.81 37.5879 11.7969 37.4808 11.7848 37.3735ZM35.5 31.1936L22.7618 36.3851C23.2864 39.4108 25.9171 41.7113 29.0834 41.7113C32.6272 41.7113 35.5 38.8295 35.5 35.2746V31.1936ZM35.5 29.0088L22.6667 35.0438V35.2746C22.6667 35.4265 22.6719 35.5771 22.6822 35.7264L35.5 30.1012V29.0088ZM35.5 26.8267L22.6667 33.6654V34.3541L35.5 27.9173V26.8267ZM35.5 24.641L22.6667 32.2851V32.9757L35.5 25.7343V24.641ZM35.5 22.4571L22.6667 30.9058V31.5955L35.5 23.5495V22.4571ZM35.5 20.2741L22.6667 29.5274V30.2162L35.5 21.3656V20.2741ZM0.67677 45.384L0.67402 45.3858L0.681354 45.3812L12.0377 38.9736C12.016 38.8672 11.9952 38.7604 11.9754 38.6533L0.677687 45.3812L0.67402 45.3858L0.670354 45.3867L0.67677 45.384Z" fill="white"/>
  </g>
  <g transform="scale(1.75) translate(250, 21)">
    <path xmlns="http://www.w3.org/2000/svg" d="M22 11L19.56 8.21L19.9 4.52L16.29 3.7L14.4 0.5L11 1.96L7.6 0.5L5.71 3.69L2.1 4.5L2.44 8.2L0 11L2.44 13.79L2.1 17.49L5.71 18.31L7.6 21.5L11 20.03L14.4 21.49L16.29 18.3L19.9 17.48L19.56 13.79L22 11ZM9.09 15.72L5.29 11.91L6.77 10.43L9.09 12.76L14.94 6.89L16.42 8.37L9.09 15.72Z" fill="white"/>
  </g>
  
      
    <text 
      x="35"
      y="430"
      font-size="10px"
      font-weight="bold"
      fill="#FFFFFF"
      font-family="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Ubuntu, Helvetica Neue, Oxygen, Cantarell, sans-serif"
    >
      test.domain
    </text>
    <text
      x="35"
      y="480"
      font-size="40px"
      fill="#FFFFFF"
      weight="400"
      font-family="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Ubuntu, Helvetica Neue, Oxygen, Cantarell, sans-serif"
    >
      .crypto
    </text>
  
    </svg>
    `.replace(/\s+/g, ''),
      );
    });
  });
});
