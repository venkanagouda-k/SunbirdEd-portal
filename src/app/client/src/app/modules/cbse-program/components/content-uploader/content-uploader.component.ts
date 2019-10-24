import { Component, OnInit, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FineUploader } from 'fine-uploader';
import { ToasterService, HttpOptions, ServerResponse } from '@sunbird/shared';
import { PublicDataService, UserService, ActionService } from '@sunbird/core';
import { UUID } from 'angular2-uuid';
import * as _ from 'lodash-es';
import { catchError, map } from 'rxjs/operators';
import { throwError, Observable } from 'rxjs';

@Component({
  selector: 'app-content-uploader',
  templateUrl: './content-uploader.component.html',
  styleUrls: ['./content-uploader.component.scss']
})
export class ContentUploaderComponent implements OnInit, AfterViewInit {
  @ViewChild('modal') modal;
  @ViewChild('fineUploaderUI') fineUploaderUI : ElementRef;
  @Input() selectedAttributes: any;
  @Output() uploadedContentMeta = new EventEmitter<any>();
  uploader;
  contentURL;

  constructor(public toasterService: ToasterService, private userService: UserService,private publicDataService: PublicDataService,public actionService: ActionService) { }

  ngOnInit() {
    
    this.uploader = new FineUploader({
      element: document.getElementById('upload-content-div'),
      template: 'qq-template-validation',
      multiple: false,
      autoUpload: false,
      request: {
        endpoint: '/assets/uploads'
      },
      validation: {
        allowedExtensions: ['pdf', 'epub', 'mp4', 'h5p', 'zip', 'webm'],
        itemLimit: 1,
        sizeLimit: 52428800 // 50 MB = 50 * 1024 * 1024 bytes
      },
      messages: {
        sizeError: "{file} is too large, maximum file size is 50MB."
      },
      callbacks: {
      onStatusChange: ()=>{

      },
      onSubmit: ()=>{
       this.uploadContent();
      }
      }
    });
  }

  ngAfterViewInit(){
    this.fineUploaderUI.nativeElement.remove();
  }

  uploadContent(){

    if (this.uploader.getFile(0) == null && !this.contentURL) {
      this.toasterService.error('URL or File is required to upload')
      return;
  }
  var fileUpload = false;
  if (this.uploader.getFile(0) != null) {
      fileUpload = true;
  }
  var mimeType = fileUpload ? this.detectMimeType(this.uploader.getName(0)) : this.detectMimeType(this.contentURL);
  if (!mimeType) {
      this.toasterService.error('Invalid content type (supported type: pdf, epub, h5p, mp4, youtube, html-zip, webm, whitelisted-domain)')
      //$scope.showLoader(false);
      return;
  } else if(mimeType === 'video/x-youtube') {
      var option = {
        url:'asset/v3/validate?field=license',
        data: {
           "request" : {
               "asset" : {
                  "provider": "youtube",
                  "url": this.contentURL
               }
           }
        }
      }
      this.actionService.post(option).pipe(catchError(err=>{
        return throwError(err)
      })).subscribe(res=>{
        this.createNewContent(fileUpload, mimeType);
      })
  } else {
      this.createNewContent(fileUpload, mimeType);
  }
  

  }

  createNewContent(fileUpload, mimeType){

    let creator = this.userService.userProfile.firstName;
      if (!_.isEmpty(this.userService.userProfile.lastName)) {
        creator = this.userService.userProfile.firstName + ' ' + this.userService.userProfile.lastName;
      }
      const option = {
        url: `private/content/v3/create`,
        data: {
          request: {
              content: {
                  "name": "Untitled Content",
                  'code': UUID.UUID(),
                  "mimeType": mimeType,
                  "createdBy": this.userService.userid,
                  //"createdFor": ecEditor._.keys(ecEditor.getContext('user').organisations),
                  "contentType": "Resource",
                  "resourceType": "Learn",
                  "creator": creator,
                  "framework": this.selectedAttributes.framework,
                  "organisation":this.selectedAttributes.onBoardSchool ? [this.selectedAttributes.onBoardSchool] : [],
    
              }
          }
      }
      }
    this.publicDataService.post(option).pipe(catchError(err=>{
      console.log("---> content creation: ", err)
      return throwError('');
    }),map(res=>{ return res.result}))
    .subscribe(result=>{
      console.log("---> content creation: ", result)
      this.uploadByURL(fileUpload, mimeType, result.node_id);
    })
  }

  uploadByURL(fileUpload, mimeType, contentId){
  if (fileUpload) {
      this.uploadFile(mimeType, contentId);
  } else {
    this.updateContentWithURL(this.contentURL, mimeType, contentId);
  }
  }

  uploadFile(mimeType, contentId){
    var contentType = mimeType;
    if (mimeType === 'application/vnd.ekstep.h5p-archive' || mimeType === 'application/vnd.ekstep.html-archive') {
        contentType = 'application/octet-stream';
    }

    let option = {
      url: 'content/v3/upload/url/'+contentId,
      data: {
        request: {
          content: {
             fileName: this.uploader.getName(0)
          }
        }
      }
      
    }
    this.actionService.post(option).pipe(catchError(err=>{
      return throwError(console.log("----> presigned value: ",err))
    })).subscribe(res=>{
      console.log("----> presined value: ",res.result);
      var signedURL = res.result.pre_signed_url;
                var config = {
                    processData: false,
                    contentType: contentType,
                    headers: {
                        'x-ms-blob-type': 'BlockBlob'
                    }
                }
              
          this.uploadToBlob(signedURL,config).subscribe(res=>{
            let fileURL = signedURL.split('?')[0];
            this.updateContentWithURL(fileURL, mimeType, contentId);
            
           
          })
    })
  }

  uploadToBlob(signedURL, config):Observable<ServerResponse>{
    return this.actionService.http.put(signedURL, this.uploader.getFile(0), config).pipe(catchError(err=>{
      return throwError(console.log("blob--->",err))
    }),map(data=>{ return data}));
  }

  updateContentWithURL(fileURL, mimeType, contentId){
    var data = new FormData();
    data.append("fileUrl", fileURL);
    data.append("mimeType", mimeType);
    var config = {
        enctype: 'multipart/form-data',
        processData: false,
        contentType: false,
        cache: false
    }
    let option = {
      url: 'content/v3/upload/'+contentId,
      data: data,
      param: config
    }
    this.actionService.post(option).pipe(catchError(err=>{
      return throwError(console.log("-->> finalUpload", err))
    })).subscribe(res=>{
      console.log("-->>finalUpload",res);
      this.getUploadedContentMeta(contentId);
    })
  }
  getUploadedContentMeta(contentId){
   let option = {
     url: 'content/v3/read/'+contentId
   }
   this.actionService.get(option).pipe(map(data=>{ return data.result.content}), catchError(err=>{
     return throwError('')
   })).subscribe(res=>{
     this.uploadedContentMeta.emit(res);
     this.modal.deny();
   })
  }

  detectMimeType(fileName) {
    var extn = fileName.split('.').pop()
    switch (extn) {
        case 'pdf':
            return 'application/pdf';
        case 'mp4':
            return 'video/mp4';
        case 'h5p':
            return 'application/vnd.ekstep.h5p-archive';
        case 'zip':
            return 'application/vnd.ekstep.html-archive';
        case 'epub':
            return 'application/epub';
        case 'webm':
            return 'video/webm';
        default:
           return this.validateUploadURL(fileName);
    }
}

validateUploadURL(url){
  var response = '';
  if(this.isValidURL(url) && this.isWhitelistedURL(url)){
      if(this.validateYoutubeURL(url)){
          response = 'video/x-youtube';
      } else {
          response =  'text/x-url';
      }
  }
  return response;
}

isValidURL(url){
  var res = url.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g);
  if(res == null) {
      return false;
  } else {
      return true;
  }
}

isWhitelistedURL(url){
  var domainList = this.getWhitelistedDomains();
  var isWhitelistedURL = false;
  var hostName = this.getHostName(url);
  if (hostName) {
      for (let domain of domainList){
          if(hostName[2] === domain || (hostName[1]+hostName[2]) === domain ){ //the whitelisted domain can be either youtube.com or www.youtube.com 
              isWhitelistedURL = true;
              break;
          }
      }
  }
  return isWhitelistedURL;
}

getHostName(url){ 
  var match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);
  if (match != null && match.length > 2 && typeof match[2] === 'string' && match[2].length > 0) {
      return match;
  } else {
      return null;
  }
}

getWhitelistedDomains(){
  var domainList = ['youtube.com','youtu.be'];
  // domains = ''//ecEditor.getConfig('extContWhitelistedDomains');
  // if(typeof domains !== 'undefined' && domains){
  //     domainList = domains.split(',');
  // }
  return domainList;
}

validateYoutubeURL = function(fileName) {
  var hostName = this.getHostName(fileName);
  if (hostName && hostName[2] === 'youtube.com' || hostName[2] === 'youtu.be') {
      return true;
  }
  return false;
}


}
