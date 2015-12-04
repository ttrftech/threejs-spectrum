// Copyright 2013 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * High-level radio control functions.
 * @constructor
 */
function RadioController() {

  var TUNERS = [{'vendorId': 0x0bda, 'productId': 0x2832}, 
                {'vendorId': 0x0bda, 'productId': 0x2838}];
  var SAMPLE_RATE = 1024000; // Must be a multiple of 512 * BUFS_PER_SEC
  //var SAMPLE_RATE = 2048000;
  var BUFS_PER_SEC = 100;
  var SAMPLES_PER_BUF = Math.floor(SAMPLE_RATE / BUFS_PER_SEC);
  var NULL_FUNC = function(){};
  var STATE = {
    OFF: 0,
    STARTING: 1,
    PLAYING: 2,
    STOPPING: 3,
    CHG_FREQ: 4
  };
  var SUBSTATE = {
    USB: 1,
    TUNER: 2,
    ALL_ON: 3,
    TUNING: 4
  };

  var state = new State(STATE.OFF);
  var requestingBlocks = 0;
  var playingBlocks = 0;
  var mode = {};
  //var frequency = 832500000;
  //var frequency = 837500000;
  //var frequency = 80400000;
  var frequency = 82500000;
  var ppm = 0;
  var actualPpm = 0;
  var offsetCount = -1;
  var offsetSum = 0;
  var autoGain = true;
  var gain = 0;
  var errorHandler;
  var tuner;
  var connection;
  var ui;
  var samples;

  /**
   * Starts playing the radio.
   * @param {Function=} opt_callback A function to call when the radio
   *     starts playing.
   */
  function start(opt_callback) {
    if (state.state == STATE.OFF) {
      state = new State(STATE.STARTING, SUBSTATE.USB, opt_callback);
      chrome.permissions.request(
        {'permissions': [{'usbDevices': TUNERS}]},
        function(res) {
          if (!res) {
            state = new State(STATE.OFF);
            throwError('This app has no permission to access the USB ports.');
          } else {
            processState();
          }
        });
    } else if (state.state == STATE.STOPPING || state.state == STATE.STARTING) {
      state = new State(STATE.STARTING, state.substate, opt_callback);
    }
  }

  /**
   * Stops playing the radio.
   * @param {Function=} opt_callback A function to call after the radio
   *     stops playing.
   */
  function stop(opt_callback) {
    if (state.state == STATE.OFF) {
      opt_callback && opt_callback();
    } else if (state.state == STATE.STARTING || state.state == STATE.STOPPING) {
      state = new State(STATE.STOPPING, state.substate, opt_callback);
    } else if (state.state != STATE.STOPPING) {
      state = new State(STATE.STOPPING, SUBSTATE.ALL_ON, opt_callback);
    }
  }

  /**
   * Tunes to another frequency.
   * @param {number} freq The new frequency in Hz.
   */
  function setFrequency(freq) {
    if (state.state == STATE.PLAYING || state.state == STATE.CHG_FREQ) {
      state = new State(STATE.CHG_FREQ, null, freq);
    } else {
      frequency = freq;
      ui && ui.update();
    }
  }

  /**
   * Returns the currently tuned frequency.
   * @return {number} The current frequency in Hz.
   */
  function getFrequency() {
    return frequency;
  }

  /**
   * Returns whether the radio is currently playing.
   * @param {boolean} Whether the radio is currently playing.
   */
  function isPlaying() {
    return state.state != STATE.OFF && state.state != STATE.STOPPING;
  }

  /**
   * Returns whether the radio is currently stopping.
   * @param {boolean} Whether the radio is currently stopping.
   */
  function isStopping() {
    return state.state == STATE.STOPPING;
  }

  /**
   * Sets automatic tuner gain.
   */
  function setAutoGain() {
    autoGain = true;
  }

  /**
   * Sets a particular tuner gain.
   * @param {number} gain The tuner gain in dB.
   */
  function setManualGain(newGain) {
    autoGain = false;
    if (newGain < 0) {
      gain = 0;
    } else if (newGain > 47.4) {
      gain = 47.4;
    } else {
      gain = newGain;
    }
  }

  /**
   * Returns whether automatic gain is currently set.
   */
  function isAutoGain() {
    return autoGain;
  }

  /**
   * Returns the currently-set manual gain in dB.
   */
  function getManualGain() {
    return gain;
  }

  /**
   * Saves a reference to the current user interface controller.
   * @param {Object} iface The controller. Must have an update() method.
   */
  function setInterface(iface) {
    ui = iface;
  }

  function getSamples() {
	return samples;
  }

  /**
   * Sets a function to be called when there is an error.
   * @param {Function} handler The function to call. Its only parameter
   *      is the error message.
   */
  function setOnError(handler) {
    errorHandler = handler;
  }

  /**
   * Handles an error.
   * @param {string} msg The error message.
   */
  function throwError(msg) {
    if (errorHandler) {
      errorHandler(msg);
    } else {
      throw msg;
    }
  }

  /**
   * Starts the decoding pipeline.
   */
  function startPipeline() {
    // In this way we read one block while we decode and play another.
    if (state.state == STATE.PLAYING) {
      processState();
    }
    processState();
  }

  /**
   * Performs the appropriate action according to the current state.
   */
  function processState() {
    switch (state.state) {
      case STATE.STARTING:
        return stateStarting();
      case STATE.PLAYING:
        return statePlaying();
      case STATE.CHG_FREQ:
        return stateChangeFrequency();
      case STATE.STOPPING:
        return stateStopping();
    }
  }

  /**
   * STARTING state. Initializes the tuner and starts the decoding pipeline.
   *
   * This state has several substates: USB (when it needs to acquire and
   * initialize the USB device), TUNER (needs to set the sample rate and
   * tuned frequency), and ALL_ON (needs to start the decoding pipeline).
   *
   * At the last substate it transitions into the PLAYING state.
   */
  function stateStarting() {
    if (state.substate == SUBSTATE.USB) {
      state = new State(STATE.STARTING, SUBSTATE.TUNER, state.param);
      doFindDevices(0);
    } else if (state.substate == SUBSTATE.TUNER) {
      state = new State(STATE.STARTING, SUBSTATE.ALL_ON, state.param);
      actualPpm = ppm;
      tuner = new RTL2832U(connection, actualPpm, autoGain ? null : gain);
      tuner.setOnError(throwError);
      tuner.open(function() {
      tuner.setSampleRate(SAMPLE_RATE, function(rate) {
      offsetSum = 0;
      offsetCount = -1;
      tuner.setCenterFrequency(frequency, function() {
      processState();
      })})});
    } else if (state.substate == SUBSTATE.ALL_ON) {
      var cb = state.param;
      state = new State(STATE.PLAYING);
      tuner.resetBuffer(function() {
      cb && cb();
      ui && ui.update();
      startPipeline();
      });
    }
  }

  /**
   * Finds the first matching tuner USB device in the tuner device definition
   * list and transitions to the next substate.
   * @param {number} index The first element in the list to find.
   */
  function doFindDevices(index) {
    if (index == TUNERS.length) {
      state = new State(STATE.OFF);
      throwError('USB tuner device not found. The Radio Receiver ' +
                 'app needs an RTL2832U-based DVB-T dongle ' +
                 '(with an R820T tuner chip) to work.');
    } else {
      chrome.usb.findDevices(TUNERS[index],
          function(conns) {
            if (conns.length == 0) {
              doFindDevices(index + 1);
            } else {
              connection = conns[0];
              processState();
            }
          });
    }
  }

  /**
   * PLAYING state. Reads a block of samples from the tuner and plays it.
   *
   * 2 blocks are in flight all at times, so while one block is being
   * demodulated and played, the next one is already being sampled.
   */
  function statePlaying() {
    ++requestingBlocks;
    tuner.readSamples(SAMPLES_PER_BUF, function(data) {
      --requestingBlocks;
      if (state.state == STATE.PLAYING) {
        //if (playingBlocks <= 2) {
          //++playingBlocks;
          //decoder.postMessage([0, data, stereoEnabled], [data]);
		  samples = data;
        //}
      }
      processState();
    });
  }

  /**
   * CHG_FREQ state. Changes tuned frequency.
   *
   * First it waits until all in-flight blocks have been dealt with. When
   * there are no more in-flight blocks it sets the new frequency, resets
   * the buffer and transitions into the PLAYING state.
   */
  function stateChangeFrequency() {
    if (requestingBlocks > 0) {
      return;
    }
    frequency = state.param;
    ui && ui.update();
    offsetSum = 0;
    offsetCount = -1;
    tuner.setCenterFrequency(frequency, function() {
    tuner.resetBuffer(function() {
    state = new State(STATE.PLAYING);
    startPipeline();
    })});
  }

  /**
   * STOPPING state. Stops playing and shuts the tuner down.
   *
   * This state has several substates: ALL_ON (when it needs to wait until
   * all in-flight blocks have been vacated and close the tuner), TUNER (when
   * it has closed the tuner and needs to close the USB device), and USB (when
   * it has closed the USB device). After the USB substate it will transition
   * to the OFF state.
   */
  function stateStopping() {
    if (state.substate == SUBSTATE.ALL_ON) {
      if (requestingBlocks > 0) {
        return;
      }
      state = new State(STATE.STOPPING, SUBSTATE.TUNER, state.param);
      ui && ui.update();
      tuner.close(function() {
        processState();
      });
    } else if (state.substate == SUBSTATE.TUNER) {
      state = new State(STATE.STOPPING, SUBSTATE.USB, state.param);
      chrome.usb.closeDevice(connection, function() {
        processState();
      });
    } else if (state.substate == SUBSTATE.USB) {
      var cb = state.param;
      state = new State(STATE.OFF);
      cb && cb();
	  samples = null;
      ui && ui.update();
    }
  }

  /**
   * Constructs a state object.
   * @param {number} state The state.
   * @param {number=} opt_substate The sub-state.
   * @param {*=} opt_param The state's parameter.
   */
  function State(state, opt_substate, opt_param) {
    return {
      state: state,
      substate: opt_substate,
      param: opt_param
    };
  }

  return {
    start: start,
    stop: stop,
    setFrequency: setFrequency,
    getFrequency: getFrequency,
    isPlaying: isPlaying,
    isStopping: isStopping,
    setAutoGain: setAutoGain,
    setManualGain: setManualGain,
    isAutoGain: isAutoGain,
    getManualGain: getManualGain,
    setInterface: setInterface,
    getSamples: getSamples,
    setOnError: setOnError
  };
}
