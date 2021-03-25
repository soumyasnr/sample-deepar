// create Agora client
var client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
var clientScreenShare = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

var localTracks = {
  videoTrack: null,
  audioTrack: null
};
var localUids = [];

var localScreenTrack = {
  screenvideoTrack: null
  // screenaudioTrack: null
};
var remoteUsers = {};
// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null
};

// Firefox 1.0+
var isFirefox = typeof InstallTrigger !== 'undefined';

// Chrome 1 - 79
var isChrome = !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime);

$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#join").attr("disabled", true);
  try {
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    options.channel = $("#channel").val();
    await join();
    if(options.token) {
      $("#success-alert-with-token").css("display", "block");
    } else {
      $("#success-alert a").attr("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
      $("#success-alert").css("display", "block");
    }
  } catch (error) {
    console.error(error);
  } finally {
    $("#leave").attr("disabled", false);
  }
})

$("#leave").click(function (e) {
  leave();
})

async function join() {

  // add event listener to play remote tracks when remote user publishs.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);
  

  // join a channel and create local tracks, we can use Promise.all to run them concurrently
  [ options.uid, localTracks.audioTrack, localTracks.videoTrack ] = await Promise.all([
    // join the channel
    client.join(options.appid, options.channel, options.token || null),
    // create local tracks, using microphone and camera
    AgoraRTC.createMicrophoneAudioTrack(),
    AgoraRTC.createCameraVideoTrack()
  ]);

  localUids.push(options.uid);
  
  // play local video track
  localTracks.videoTrack.play("local-player");


  //DeepAr
  initDeepAr();




  
  $("#local-player-name").text(`localVideo(${options.uid})`);
  const player = $(`
          <i class="fas fa-microphone"></i>
          <i class="fas fa-video"></i>
          <i class="fas fa-desktop"></i>
    `);
  $(".local-player-ctrls").html('');
  $(".local-player-ctrls").append(player);
  $(".local-player-ctrls").show();

  $(".local-player-ctrls>i").click(function(event) {
    event.preventDefault();
    console.log($(event.target).attr('class'));
    switch($(event.target).attr('class')){
      case 'fas fa-microphone':
          localTracks.audioTrack.setVolume(0);
          $(event.target).toggleClass('fa-microphone fa-microphone-slash');
          break;

      case 'fas fa-microphone-slash':
          localTracks.audioTrack.setVolume(100);
          $(event.target).toggleClass('fa-microphone fa-microphone-slash');
          break;

      case 'fas fa-video':
          localTracks.videoTrack.stop();
          $(event.target).toggleClass('fa-video fa-video-slash');
          break;

      case 'fas fa-video-slash':
          localTracks.videoTrack.play("local-player");
          $(event.target).toggleClass('fa-video fa-video-slash');
          break;

      case 'fas fa-desktop':
          if($(event.target).css('color') == 'rgb(0, 0, 0)'){
            $(event.target).css('color','red');
            Promise.all([startScreenCall()]).then(() => { 

            });
          }else{
            leaveScreenShare();
            $(event.target).css('color','rgb(0, 0, 0)');
          }
          
      break;

    }
    console.log($(event.target).attr('class'));
  });

  // publish local tracks to channel
  await client.publish(Object.values(localTracks));
  console.log("publish success");
}

function initDeepAr() {
    var canvasHeight = window.innerHeight;
    var canvasWidth = window.innerWidth;
      
      // desktop, the width of the canvas is 0.66 * window height and on mobile it's fullscreen
      if (window.innerWidth > window.innerHeight) {
        canvasWidth = Math.floor(window.innerHeight*0.66);
      }

      var videoElmt = document.getElementsByClassName("agora_video_player")[0];
      
      var deepAR = DeepAR({ 
        canvasWidth: canvasWidth, 
        canvasHeight: canvasHeight,
        licenseKey: $("#deeparLicenseKey").val(),
        canvas: document.getElementById("deepar-canvas"), //videoElmt, //document.getElementById("deepar-canvas")  renders filter in the canvas, but I want it to be on the agora video track
        numberOfFaces: 1,
        libPath: './lib',
        segmentationInfoZip: 'segmentation.zip',
        onInitialize: function() {
          // start video immediately after the initalization, mirror = true
          // deepAR.startVideo(false);

          // or we can setup the video element externally and call deepAR.setVideoElement (see startExternalVideo function below)

          deepAR.switchEffect(0, 'slot', './effects/background_segmentation', function() {
            // effect loaded
          });
        }
      });

      deepAR.onCameraPermissionAsked = function() {
        console.log('camera permission asked');
      };

      deepAR.onCameraPermissionGranted = function() {
        console.log('camera permission granted');
      };

      deepAR.onCameraPermissionDenied = function() {
        console.log('camera permission denied');
      };

      deepAR.onScreenshotTaken = function(photo) {
        console.log('screenshot taken');
      };

      deepAR.onImageVisibilityChanged = function(visible) {
        console.log('image visible', visible);
      };

      deepAR.onFaceVisibilityChanged = function(visible) {
        console.log('face visible', visible);
      };

      deepAR.onVideoStarted = function() {
        var loaderWrapper = document.getElementById('loader-wrapper');
        loaderWrapper.style.display = 'none';
      };

      deepAR.downloadFaceTrackingModel('lib/models-68-extreme.bin');


      deepAR.setVideoElement(videoElmt, true);

      // Position the carousel to cover the canvas
      if (window.innerWidth > window.innerHeight) {
        var width = Math.floor(window.innerHeight*0.66);
        var carousel = document.getElementsByClassName('effect-carousel')[0];
        carousel.style.width = width + 'px';
        carousel.style.marginLeft = (window.innerWidth-width)/2 + "px";
      }


      $(document).ready(function() {
        $('.effect-carousel').slick({
          slidesToShow: 1,
          centerMode: true,
          focusOnSelect: true,
          arrows: false,
          accessibility: false,
          variableWidth: true
        });

        var effects = [
          './effects/background_segmentation',
          './effects/aviators',
          './effects/beard',
          './effects/dalmatian',
          './effects/flowers',
          './effects/koala',
          './effects/lion',
          './effects/teddycigar'
        ];

        $('.effect-carousel').on('afterChange', function(event, slick, currentSlide){
          deepAR.switchEffect(0, 'slot', effects[currentSlide]);
        });

        // startExternalVideo();
      });      

}
async function startScreenCall() {

  var screen_uid ;
  // join a channel and create local tracks, we can use Promise.all to run them concurrently
  [ screen_uid,  localScreenTrack.screenvideoTrack ] = await Promise.all([
    // join the channel
    clientScreenShare.join(options.appid, options.channel, options.token || null),
    // create local tracks, using microphone and camera
    AgoraRTC.createScreenVideoTrack()
  ]);

  localUids.push(screen_uid);
  
  // play local video track
  $("#local-screen-player").addClass("player");
  localScreenTrack.screenvideoTrack.play("local-screen-player");


  // publish local tracks to channel
  await clientScreenShare.publish(Object.values(localScreenTrack));
  console.log("publish success");

}

async function leaveScreenShare() {
  for (trackName in localScreenTrack) {
    var track = localTracks[trackName];
    if(track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }

  $("#local-screen-player").html("");
  $("#local-screen-player").removeClass("player");
  $("#local-screen-player").find(`[data-slide='${current}']`);
  // leave the channel
  await clientScreenShare.leave();
  console.log("clientScreenShare leaves channel success");
}

async function leave() {
  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if(track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }

  // remove remote users and player views
  remoteUsers = {};
  $("#remote-playerlist").html("");

  // leave the channel
  await client.leave();

  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $(".local-player-ctrls").hide();

  console.log("client leaves channel success");
}



async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === 'video') {
    const player = $(`
      <div id="player-wrapper-${uid}">
        <p class="player-name">remoteUser(${uid})</p>
        <div id="player-${uid}" class="player"></div>
        <div class="video-player-ctrls" data-uid="${uid}">
          <i class="fas fa-microphone"></i>
          <i class="fas fa-video"></i>
          <i class="fas fa-desktop"></i>
        </div>
      </div>
    `);
    $("#remote-playerlist").append(player);
    user.videoTrack.play(`player-${uid}`);
    $(".video-player-ctrls>i").click(function(event) {
      event.preventDefault();
      $(event.target).attr('disabled',true);
      console.log($(event.target));
      var id = $(event.target).parent().data('uid');
      switch($(event.target).attr('class')){
        case 'fas fa-microphone':
            remoteUsers[id].audioTrack.setVolume(0);
            $(event.target).toggleClass('fa-microphone fa-microphone-slash');
            break;

        case 'fas fa-microphone-slash':
            remoteUsers[id].audioTrack.setVolume(100);
            $(event.target).toggleClass('fa-microphone fa-microphone-slash');
            break;

        case 'fas fa-video':
            remoteUsers[id].videoTrack.stop();
            $(event.target).toggleClass('fa-video fa-video-slash');

            break;

        case 'fas fa-video-slash':
            remoteUsers[id].videoTrack.play(`player-${id}`);

            $(event.target).toggleClass('fa-video fa-video-slash');
            break;

        case 'fas fa-desktop':
            if($(event.target).css('color') == 'rgb(0, 0, 0)'){
              $(event.target).css('color','rgb(118, 118, 118)');
            }else{
              $(event.target).css('color','rgb(0, 0, 0)');
            }
            
        break;

      }
      console.log($(event.target).attr('class'));
    });

  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }
}

function handleUserPublished(user, mediaType) {
  const id = user.uid;
  //checking whether published uid is any of the local clients. Do not subscribe to local stream, it costs more.
  if(!localUids.includes(id)){
    remoteUsers[id] = user;
    subscribe(user, mediaType);
  }
  
}

function handleUserUnpublished(user) {
  const id = user.uid;
  delete remoteUsers[id];
  $(`#player-wrapper-${id}`).remove();
}



