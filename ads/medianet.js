/**
 * Copyright 2016 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {writeScript, validateData, computeInMasterFrame} from '../3p/3p';
import {getSourceUrl} from '../src/url';
import {doubleclick} from '../ads/google/doubleclick';

const mandatoryParams = ['tagtype', 'cid'],
  optionalParams = [
    'timeout',
    'slot', 'targeting', 'categoryExclusions',
    'tagForChildDirectedTreatment', 'cookieOptions',
    'overrideWidth', 'overrideHeight', 'loadingStrategy',
    'consentNotificationId', 'useSameDomainRenderingUntilDeprecated',
    'experimentId', 'multiSize', 'multiSizeValidation',
  ],
  dfpParams = [
    'slot', 'targeting', 'categoryExclusions',
    'tagForChildDirectedTreatment', 'cookieOptions',
    'overrideWidth', 'overrideHeight', 'loadingStrategy',
    'consentNotificationId', 'useSameDomainRenderingUntilDeprecated',
    'experimentId', 'multiSize', 'multiSizeValidation',
  ],
  dfpDefaultTimeout = 1000;

/**
 * @param {!Window} global
 * @param {!Object} data
 */
export function medianet(global, data) {
  validateData(data, mandatoryParams, optionalParams);

  const publisherUrl = global.context.canonicalUrl ||
      getSourceUrl(global.context.location.href),
    referrerUrl = global.context.referrer;

  if (data.tagtype === 'headerbidder') { //parameter tagtype is used to identify the product the publisher is using. Going ahead we plan to support more product types.
    loadHBTag(global, data, publisherUrl, referrerUrl);
  setAdditionalData(data);
  if (data.tagtype === 'sync') {
    loadSyncTag(global, data);
  }
}

/**
 * @param {!Window} global
 * @param {!Object} data
 */
function loadSyncTag(global, data) {
    /*eslint "google-camelcase/google-camelcase": 0*/

  let url = 'https://contextual.media.net/ampnmedianet.js?';
  url += 'cid=' + encodeURIComponent(data.cid);
  url += '&https=1';
  url += '&requrl=' + encodeURIComponent(data.requrl);
  setMacro(data, 'versionId');
  setMacro(data, 'requrl');
  setMacro(data, 'width');
  setMacro(data, 'height');
  setMacro(data, 'crid');

  if (data.refurl) {
    url += '&refurl=' + encodeURIComponent(data.refurl);
    setMacro(data, 'refurl');
  }

  if (data.misc) {
    setMacro(data, 'misc');
  }
  setCallbacks(global);
  writeScript(global, url);
}

function setMacro(data, type) {
  if (!type) {
    return;
  }
  const name = 'medianet_' + type;
  if (data[type]) {
    global[name] = data[type];
  }
}

function setCallbacks(global) {
  function renderStartCb(opt_data) {
    console.log('renderStartCalled');
    global.context.renderStart(opt_data);
  }
  function reportRenderedEntityIdentifierCb(ampId) {
    console.log('reported rendered entity' + ampId);
    //check for id, and pass default if not available
    global.context.reportRenderedEntityIdentifier(ampId);
  }
  function noContentAvailableCb() {
    console.log('no content available called');
    global.context.noContentAvailable();
  }

  const callbacks = {
    renderStartCb,
    reportRenderedEntityIdentifierCb,
    noContentAvailableCb,
  };
  global._mNAmp = callbacks;

}

function setAdditionalData(data) {
  data.requrl = global.context.canonicalUrl ||
      getSourceUrl(global.context.location.href);
  data.refurl = global.context.referrer;
  data.versionId = '211213';
 * @param {!string} publisherUrl
 * @param {?string} referrerUrl
 */
function loadHBTag(global, data, publisherUrl, referrerUrl) {
  function deleteUnexpectedDoubleclickParams() {
    const allParams = mandatoryParams.concat(optionalParams);
    let currentParam = '';
    for (let i = 0; i < allParams.length; i++) {
      currentParam = allParams[i];
      if (dfpParams.indexOf(currentParam) === -1 && data[currentParam]) {
        delete data[currentParam];
      }
    }
  }

  let isDoubleClickCalled = false;

  function loadDFP() {
    if (isDoubleClickCalled) {
      return;
    }
    isDoubleClickCalled = true;

    global.advBidxc = global.context.master.advBidxc;
    if (global.advBidxc && typeof global.advBidxc.renderAmpAd === 'function') {
      global.addEventListener('message', event => {
        global.advBidxc.renderAmpAd(event, global);
      });
    }

    data.targeting = data.targeting || {};

    if (global.advBidxc &&
      typeof global.advBidxc.setAmpTargeting === 'function') {
      global.advBidxc.setAmpTargeting(global, data);
    }
    deleteUnexpectedDoubleclickParams();
    doubleclick(global, data);
  }

  function mnetHBHandle() {
    global.advBidxc = global.context.master.advBidxc;
    if (global.advBidxc &&
      typeof global.advBidxc.registerAmpSlot === 'function') {
      global.advBidxc.registerAmpSlot({
        cb: loadDFP,
        data,
        winObj: global,
      });
    }
  }

  global.setTimeout(() => {
    loadDFP();
  }, data.timeout || dfpDefaultTimeout);

  computeInMasterFrame(global, 'medianet-hb-load', done => {
    /*eslint "google-camelcase/google-camelcase": 0*/
    global.advBidxc_requrl = publisherUrl;
    global.advBidxc_refurl = referrerUrl;
    global.advBidxc = {
      registerAmpSlot: () => {},
      setAmpTargeting: () => {},
      renderAmpAd: () => {},
    };
    writeScript(global, 'https://contextual.media.net/bidexchange.js?https=1&amp=1&cid=' + encodeURIComponent(data.cid), () => {
      done(null);
    });
  }, mnetHBHandle);
}
