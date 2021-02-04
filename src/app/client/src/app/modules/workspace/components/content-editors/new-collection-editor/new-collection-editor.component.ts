import { Component, OnInit } from '@angular/core';
import { UserService, PublicDataService, ContentService } from '@sunbird/core';
import { TelemetryService } from '@sunbird/telemetry';
import { ConfigService } from '@sunbird/shared';
import * as _ from 'lodash-es';
@Component({
  selector: 'app-new-collection-editor',
  templateUrl: './new-collection-editor.component.html',
  styleUrls: ['./new-collection-editor.component.scss']
})
export class NewCollectionEditorComponent implements OnInit {
  public editorConfig: any;
  public deviceId: string;
  public portalVersion: string;
  public userProfile: any;
  constructor(private userService: UserService, private telemetryService: TelemetryService, private publicDataService: PublicDataService,
    private config: ConfigService, private contentService: ContentService) {
    const deviceId = (<HTMLInputElement>document.getElementById('deviceId'));
    this.deviceId = deviceId ? deviceId.value : '';
    const buildNumber = (<HTMLInputElement>document.getElementById('buildNumber'));
    this.portalVersion = buildNumber && buildNumber.value ? buildNumber.value.slice(0, buildNumber.value.lastIndexOf('.')) : '1.0';
  }

  ngOnInit() {
    this.userProfile = this.userService.userProfile;
    this.setEditorConfig();
    this.getFrameWorkDetails();
  }

  getCategoryDefinition() {
    const req = {
      url: 'object/category/definition/v1/read?fields=objectMetadata,forms,name',
      data: {
        request: {
          objectCategoryDefinition: {
              objectType: 'Collection',
              name: 'Course',
              channel: this.userService.channel
          }
        }
      }
    };
    return this.publicDataService.post(req);
  }

  getFrameWorkDetails() {
    this.getCategoryDefinition().subscribe(data => {
      // data.result.objectCategoryDefinition.objectMetadata.config = {
      //   "frameworkMetadata": {
      //     "orgFWType": "K-12",
      //     "targetFWType": "TPD"
      //   }
      // };
      // tslint:disable-next-line:max-line-length
      if (_.get(data, 'result.objectCategoryDefinition.objectMetadata.schema') || _.get(data, 'result.objectCategoryDefinition.objectMetadata.config')) {
        const orgFramework = _.get(data, 'result.objectCategoryDefinition.objectMetadata.schema.properties.framework.default');
        const targetFramework = _.get(data, 'result.objectCategoryDefinition.objectMetadata.schema.properties.targetFWIds.default');
        if (orgFramework) {
          this.setFrameworkToEditorConfig({orgFramework});
        } else {
          this.getFrameworkByConfig(_.get(data, 'result.objectCategoryDefinition'), 'orgFWType');
        }
        if (targetFramework) {
          this.setFrameworkToEditorConfig({targetFramework});
        } else {
          this.getFrameworkByConfig(_.get(data, 'result.objectCategoryDefinition'), 'targetFWType');
        }
      } else {
        alert('Please set proper framework');
      }
    }, err => {
      console.log('err--->', err);
    });
  }

  getFrameworkByConfig(categoryDefdata, type) {
    const frameWorkType = _.get(categoryDefdata, `objectMetadata.config.frameworkMetadata.${type}`);
    if (frameWorkType) {
      this.getDefaultFramework(frameWorkType, true).subscribe(data => {
        console.log(data, 'composite search data');
        if (!_.get(data, 'result.count')) {
          this.getDefaultFramework(frameWorkType, false).subscribe(res => {
            this.frameworkByType(type, res);
          });
        } else {
          this.frameworkByType(type, data);
        }
      });
    } else {
      alert('Please set proper framework');
    }
  }

  frameworkByType(type, resData) {
    if (type === 'orgFWType') {
      this.setFrameworkToEditorConfig({orgFramework: _.get(resData, 'result.Framework[0].identifier')});

    } else if (type === 'targetFWType') {
      this.setFrameworkToEditorConfig({targetFramework: _.get(resData, 'result.Framework[0].identifier')});
    }
  }

  getDefaultFramework(type, channel: boolean) {
    const option = {
      url: `${this.config.urlConFig.URLS.COMPOSITE.SEARCH}`,
      'data': {
        'request': {
            'filters': {
                'objectType': 'Framework',
                'type': type,
                'status': 'Live',
                ...(channel && {channel: this.userService.channel})
            },
            'limit': 10
        }
    }
      };
      return this.contentService.post(option);
  }

  setFrameworkToEditorConfig(framework) {
    if (_.get(framework, 'orgFramework')) {
      this.editorConfig.context.framework = _.get(framework, 'orgFramework');
    } else if (_.get(framework, 'targetFramework')) {
      this.editorConfig.context.framework = _.get(framework, 'targetFramework');
    }
  }

  setEditorConfig() {
    this.editorConfig = {
      context: {
        identifier: 'do_113193433773948928111',
        channel: this.userService.channel,
        framework: '',
        targetFWIds: [],
        authToken: ' ',
        sid: this.userService.sessionId,
        did: this.deviceId,
        uid: this.userService.userid,
        additionalCategories: [
          {
            value: 'Classroom Teaching Video',
            label: 'Classroom Teaching Video'
          },
          {
            value: 'Concept Map',
            label: 'Concept Map'
          },
          {
            value: 'Curiosity Question Set',
            label: 'Curiosity Question Set'
          },
          {
            value: 'Textbook',
            label: 'Textbook'
          },
          {
            value: 'Experiential Resource',
            label: 'Experiential Resource'
          },
          {
            value: 'Explanation Video',
            label: 'Explanation Video'
          },
          {
            value: 'Focus Spot',
            label: 'Focus Spot'
          },
          {
            value: 'Learning Outcome Definition',
            label: 'Learning Outcome Definition'
          },
          {
            value: 'Marking Scheme Rubric',
            label: 'Marking Scheme Rubric'
          },
          {
            value: 'Pedagogy Flow',
            label: 'Pedagogy Flow'
          },
          {
            value: 'Lesson Plan',
            label: 'Lesson Plan'
          },
          {
            value: 'Previous Board Exam Papers',
            label: 'Previous Board Exam Papers'
          },
          {
            value: 'TV Lesson',
            label: 'TV Lesson'
          }
        ],
        pdata: {
          id: this.userService.appId,
          ver: this.portalVersion,
          pid: 'sunbird-portal'
        },
        contextRollup: this.telemetryService.getRollUpData(this.userProfile.organisationIds),
        tags: this.userService.dims,
        cdata: [
          {
            id: '01307938306521497658',
            type: 'sourcing_organization',
          },
          {
            type: 'project',
            id: 'ec5cc850-3f71-11eb-aae1-fb99d9fb6737',
          },
          {
            type: 'linked_collection',
            id: 'do_113140468925825024117'
          }
        ],
        timeDiff: this.userService.getServerTimeDiff,
        objectRollup: {
            l1: 'do_113140468925825024117',
            l2: 'do_113140468926914560125'
        },
        host: '',
        defaultLicense: [
          {
            identifier: 'cc-by-4.0',
            lastStatusChangedOn: '2020-03-22T16:03:38.003+0000',
            consumerId: '9f1bd4a1-c617-422b-8d5a-d24c7d3ade2e',
            description: 'For details see below:',
            graph_id: 'domain',
            nodeType: 'DATA_NODE',
            createdOn: '2020-03-22T16:03:38.003+0000',
            url: 'https://creativecommons.org/licenses/by/4.0/legalcode',
            versionKey: '1584893018003',
            objectType: 'License',
            name: 'CC BY 4.0',
            lastUpdatedOn: '2020-03-22T16:03:38.003+0000',
            status: 'Live',
            node_id: 60
          }
        ],
        endpoint: '/data/v3/telemetry',
        env: 'collection_editor',
        aws_s3_urls : [
          'https://s3.ap-south-1.amazonaws.com/ekstep-public-qa/',
          'https://ekstep-public-qa.s3-ap-south-1.amazonaws.com/',
          'https://dockstorage.blob.core.windows.net/sunbird-content-dock/']
      },
      config: {
        mode: 'edit',
        maxDepth: 2,
        objectType: 'Collection',
        primaryCategory: 'Course',
        isRoot: true,
        iconClass: 'fa fa-book',
        children: {},
        hierarchy: {
            level1: {
                name: 'Chapter',
                type: 'Unit',
                mimeType: 'application/vnd.ekstep.content-collection',
                contentType: 'Textbook Unit',
                iconClass: 'fa fa-folder-o',
                children: {}
            },
            level2: {
                name: 'Sub-Chapter',
                type: 'Unit',
                mimeType: 'application/vnd.ekstep.content-collection',
                contentType: 'Textbook Unit',
                iconClass: 'fa fa-folder-o',
                children: {
                    Content: [
                        'Explanation Content',
                        'Learning Resource',
                        'eTextbook',
                        'Teacher Resource',
                        'Course Assessment'
                    ],
                    QuestionSet: [
                        'Practice Question Set'
                    ]
                }
            }
        }
      }
    };
  }
}
