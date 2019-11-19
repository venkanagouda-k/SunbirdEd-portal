import {
  Component,
  OnInit,
  Input,
  EventEmitter,
  Output,
  OnChanges,
  OnDestroy
} from "@angular/core";
import {
  PublicDataService,
  UserService,
  CollectionHierarchyAPI,
  ActionService
} from "@sunbird/core";
import {
  ConfigService,
  ServerResponse,
  ContentData,
  ToasterService
} from "@sunbird/shared";
import { TelemetryService } from "@sunbird/telemetry";
import { CbseProgramService } from "../../services";
import { map, catchError } from "rxjs/operators";
import { forkJoin, of, throwError } from "rxjs";
import { Router, ActivatedRoute } from "@angular/router";
import * as _ from "lodash-es";
import { QuestionListComponent } from "../question-list/question-list.component";
import { ContentUploaderComponent } from "../content-uploader/content-uploader.component";
import { QuestionPreviewComponent } from "../question-preview/question-preview.component";
import { QuestionCreationHeaderComponent } from "../question-creation-header/question-creation-header.component";

@Component({
  selector: "app-chapter-list",
  templateUrl: "./chapter-list.component.html",
  styleUrls: ["./chapter-list.component.scss"]
})
export class ChapterListComponent implements OnInit, OnChanges {
  @Input() selectedAttributes: any;
  @Input() topicList: any;
  @Input() role: any;
  @Output() selectedQuestionTypeTopic = new EventEmitter<any>();
  @Output() selectedTemplate = new EventEmitter<any>();
  @Input() selectedSchool: any;

  public textBookChapters: Array<any> = [];
  private questionType: Array<any> = [];
  private textBookMeta: any;
  public hierarchyObj = {};
  public collectionHierarchy: any;
  public templateDetails: any = {};
  public selectedChapter;
  public inputs: any;
  public outputs: any;
  public contentData: any;
  selectedComponentHeader;
  inputsHeader;
  outputsHeader;
  selectedComponent;

  private questionTypeName = {
    vsa: "Very Short Answer",
    sa: "Short Answer",
    la: "Long Answer",
    mcq: "Multiple Choice Question",
    curiosity: "Curiosity Question"
  };
  private creationComponentsList = {
    ExplanationResource: ContentUploaderComponent,
    ExperientialResource: ContentUploaderComponent,
    PracticeQuestionSet: QuestionListComponent,
    CuriosityQuestionSet: QuestionListComponent,
    ContentPreview: QuestionPreviewComponent,
    ContentHeader: QuestionCreationHeaderComponent
  };

  telemetryImpression = {};
  private labels: Array<string>;
  public collectionData;
  showLoader = true;
  showError = false;
  showUpload = false;
  showResourceTemplatePopup = false;
  public routerQuestionCategory: any;
  public questionPattern: Array<any> = [];
  public configResourceList = [
    {
      name: "Explanation",
      contentType: "ExplanationResource",
      mimeType: ["application/pdf"],
      filesAccepted: "pdf",
      filesize: "50"
    },
    {
      name: "Experimental",
      contentType: "ExperientialResource",
      mimeType: ["video/mp4", "video/webm", "video/x-youtube"],
      filesAccepted: "mp4, webm, youtube",
      filesize: "50"
    },
    {
      name: "Practice Sets",
      contentType: "PracticeQuestionSet",
      mimeType: ["application/vnd.ekstep.ecml-archive"],
      questionCategories: ["vsa", "sa", "la", "mcq"]
    },
    {
      name: "Curiosity",
      contentType: "CuriosityQuestionSet",
      mimeType: ["application/vnd.ekstep.ecml-archive"],
      questionCategories: ["curiosity"]
    }
  ];
  constructor(
    public publicDataService: PublicDataService,
    private configService: ConfigService,
    private userService: UserService,
    public actionService: ActionService,
    public telemetryService: TelemetryService,
    private cbseService: CbseProgramService,
    public toasterService: ToasterService,
    public router: Router,
    public activeRoute: ActivatedRoute
  ) {}
  private labelsHandler() {
    this.labels =
      this.role.currentRole === "REVIEWER"
        ? ["Up for Review", "Accepted"]
        : this.role.currentRole === "PUBLISHER"
        ? ["Total", "Accepted", "Published"]
        : ["Total", "Created by me", "Needs attention"];
  }
  ngOnInit() {
    /**
     * @description : this will fetch question Category configuration based on currently active route
     */
    this.activeRoute.data.subscribe(routerData => {
      this.routerQuestionCategory = routerData.config.question_categories;
      this.questionType = this.routerQuestionCategory;

      routerData.config.question_categories.map(category => {
        if (category !== "mcq") {
          this.questionPattern.push("reference");
        } else {
          this.questionPattern.push("mcq");
        }
      });
    });
    this.labelsHandler();
    this.telemetryImpression = {
      context: {
        env: "cbse_program"
      },
      edata: {
        type: "view",
        pageid: "chapterlist",
        uri: this.router.url
      }
    };
    this.getCollectionHierarchy(this.selectedAttributes.textbook);
    // clearing the selected questionId when user comes back from question list
    delete this.selectedAttributes["questionList"];
  }
  ngOnChanges(changed: any) {
    this.labelsHandler();
    if (this.textBookMeta) {
      if (
        changed.selectedSchool &&
        changed.selectedSchool.currentValue !==
          changed.selectedSchool.previousValue
      ) {
        this.selectedAttributes.selectedSchoolForReview =
          changed.selectedSchool.currentValue;
        this.showChapterList(this.textBookMeta);
      } else {
        this.showChapterList(this.textBookMeta);
      }
    }
  }

  public getCollectionHierarchy(identifier: string) {
    let hierarchy;
    const req = {
      url: "content/v3/hierarchy/" + identifier, // `${this.configService.urlConFig.URLS.COURSE.HIERARCHY}/${identifier}`,
      param: { mode: "edit" }
    };
    this.actionService
      .get(req)
      .pipe(
        catchError(err => {
          let errInfo = { errorMsg: "Fetching TextBook details failed" };
          this.showLoader = false;
          return throwError(this.cbseService.apiErrorHandling(err, errInfo));
        })
      )
      .subscribe(response => {
        this.collectionData = response.result.content;
        hierarchy = this.getHierarchyObj(this.collectionData);
        this.selectedAttributes.hierarchyObj = { hierarchy };
        const textBookMetaData = [];
        this.collectionHierarchy = this.getUnitWithChildren(
          this.collectionData.children
        );
        console.log(this.collectionHierarchy);
        _.forEach(this.collectionData.children, data => {
          if (data.topic && data.topic[0]) {
            if (data.children) {
              let questionBankUnit: any;
              if (_.includes(this.questionType, "curiosity")) {
                questionBankUnit = _.find(data.children, val => {
                  return val.name === "Curiosity Questions";
                });
              } else {
                questionBankUnit = _.find(data.children, val => {
                  return (
                    val.name === "Question Bank" ||
                    val.name === "Practice Questions"
                  );
                });
              }
              textBookMetaData.push({
                name: data.name,
                topic: data.topic[0],
                identifier: questionBankUnit
                  ? questionBankUnit.identifier
                  : data.identifier
              });
            } else {
              textBookMetaData.push({
                name: data.name,
                topic: data.topic[0],
                identifier: data.identifier
              });
            }
          }
        });
        this.textBookMeta = textBookMetaData;

        this.showChapterList(textBookMetaData);
        this.getUnitLevelCount(this.collectionHierarchy);
      });
      
  }

  getUnitLevelCount(collectionHierarchy) {
    const textbookLevelCount = {
      L1: 0, L2: 0, L3: 0, L4: 0, collection: 0, Resource: 0, LessonPlan: 0, PracticeQuestionSet: 0, Curiosity: 0
    }
    var n = 1;
    function recursive(level){
      if(level.contentType === "TextBookUnit") {
        textbookLevelCount[`L${n}`]++;
        if(level.leaf && level.leaf.length > 0){
          _.forEach(level.leaf, (resource) => {
           (resource.contentType === "Collection") ? textbookLevelCount['collection']++ : null;
           (resource.contentType === "Resource") ? textbookLevelCount['Resource']++ : null;
           (resource.contentType === "LessonPlan") ? textbookLevelCount['LessonPlan']++ : null;
           (resource.contentType === "PracticeQuestionSet") ? textbookLevelCount["PracticeQuestionSet"]++ : null;
           (resource.contentType === "Curiosity") ? textbookLevelCount['Curiosity']++ : null;
          })
        }
        if(level.children && level.children.length > 0){
          n = n+1;
          recursive(level.children[0])
        }
      }
    }
    _.forEach(collectionHierarchy, (level) => {
      n = 1;
      recursive(level);
      console.log(textbookLevelCount);
    });
    
  }

  getUnitWithChildren(data) {
    const self = this;
    const tree = data.map(child => {
      const treeItem = {
        identifier: child.identifier,
        name: child.name,
        contentType: child.contentType,
        topic: child.topic
      };
      const textbookUnit = _.find(child.children, [
        "contentType",
        "TextBookUnit"
      ]);
      if (child.children) {
        const treeUnit = self.getUnitWithChildren(child.children);
        const treeChildren = treeUnit.filter(
          item => item.contentType === "TextBookUnit"
        );
        const treeLeaf = treeUnit.filter(
          item => item.contentType !== "TextBookUnit"
        );
        treeItem["children"] = treeChildren.length > 0 ? treeChildren : null;
        treeItem["leaf"] = treeLeaf.length > 0 ? treeLeaf : null;
      }
      return treeItem;
    });
    return tree;
  }
  public getHierarchyObj(data) {
    const instance = this;
    if (data.identifier) {
      this.hierarchyObj[data.identifier] = {
        name: data.name,
        contentType: data.contentType,
        children: _.map(data.children, child => {
          return child.identifier;
        }),
        root: data.contentType === "TextBook" ? true : false
      };
      if (data.children) {
        _.forEach(data.children, collection => {
          instance.getHierarchyObj(collection);
        });
      }
    }

    return this.hierarchyObj;
  }

  public showChapterList(textBookMetaData) {
    let apiRequest;
    if (this.selectedAttributes.currentRole === "CONTRIBUTOR") {
      apiRequest = [
        ...this.questionType.map(fields => this.searchQuestionsByType(fields)),
        ...this.questionType.map(fields =>
          this.searchQuestionsByType(fields, this.userService.userid)
        ),
        ...this.questionType.map(fields =>
          this.searchQuestionsByType(fields, this.userService.userid, "Reject")
        )
      ];
    } else if (this.selectedAttributes.currentRole === "REVIEWER") {
      apiRequest = [
        ...this.questionType.map(fields =>
          this.searchQuestionsByType(fields, "", "Review")
        ),
        ...this.questionType.map(fields =>
          this.searchQuestionsByType(fields, "", "Live")
        )
      ];
    } else if (this.selectedAttributes.currentRole === "PUBLISHER") {
      apiRequest = [
        ...this.questionType.map(fields => this.searchQuestionsByType(fields)),
        ...this.questionType.map(fields =>
          this.searchQuestionsByType(fields, "", "Live")
        ),
        ...this.questionType.map(type => this.searchResources(type))
      ];
    }

    if (!apiRequest) {
      this.showLoader = false;
      this.showError = true;
      this.toasterService.error(
        `You don't have permission to access this page`
      );
    }
    forkJoin(apiRequest).subscribe(
      data => {
        this.showLoader = true;
        this.textBookChapters = _.map(textBookMetaData, topicData => {
          const results = {
            name: topicData.name,
            topic: topicData.topic,
            identifier: topicData.identifier
          };
          _.forEach(this.questionType, (type: string, index) => {
            results[type] = {
              name: type,
              total: this.getResultCount(data[index], topicData.topic),
              me: this.getResultCount(
                data[index + this.questionType.length],
                topicData.topic
              ),
              attention: this.getResultCount(
                data[index + 2 * this.questionType.length],
                topicData.topic
              ),
              buttonStatus: this.getButtonStatus(
                data[index + 2 * this.questionType.length],
                topicData.topic
              ),
              resourceName: this.getResourceName(
                data[index + 2 * this.questionType.length],
                topicData.topic
              )
            };
          });
          this.showLoader = false;
          // text book-unit-id added
          results.identifier = topicData.identifier;
          return results;
        });
      },
      error => {
        this.showLoader = false;
      }
    );
  }

  public getResultCount(data, topic: string) {
    const topicData = _.find(data, { name: topic.toLowerCase() });
    return topicData ? topicData.count : 0;
  }

  public getResourceName(data, topic: string) {
    const topicData = _.find(data, { name: topic.toLowerCase() });
    // tslint:disable-next-line:max-line-length
    return topicData ? topicData.resourceName : false;
  }
  public getButtonStatus(data, topic: string) {
    const topicData = _.find(data, { name: topic.toLowerCase() });
    return topicData ? topicData.resourceId : 0;
  }

  public searchResources(qtype) {
    const request = {
      url: `${this.configService.urlConFig.URLS.COMPOSITE.SEARCH}`,
      data: {
        request: {
          filters: {
            objectType: "content",
            contentType:
              qtype === "curiosity"
                ? "CuriosityQuestionSet"
                : "PracticeQuestionSet",
            mimeType: "application/vnd.ekstep.ecml-archive",
            board: this.selectedAttributes.board,
            framework: this.selectedAttributes.framework,
            gradeLevel: this.selectedAttributes.gradeLevel,
            subject: this.selectedAttributes.subject,
            medium: this.selectedAttributes.medium,
            status: ["Live"],
            questionCategories:
              qtype === "curiosity" ? "CuriosityQuestion" : qtype.toUpperCase()
          },
          sort_by: { createdOn: "desc" },
          fields: [
            "identifier",
            "status",
            "createdOn",
            "topic",
            "name",
            "questions"
          ],
          facets: ["topic"]
        }
      }
    };
    return this.publicDataService.post(request).pipe(
      map(res => {
        const content = _.get(res, "result.content");
        const publishCount = [];
        _.forIn(_.groupBy(content, "topic"), (value, key) => {
          // publishCount.push({name: key.toLowerCase(), count: _.uniq([].concat(..._.map(value, 'questions'))).length });
          // tslint:disable-next-line:max-line-length
          publishCount.push({
            name: key.toLowerCase(),
            count: _.uniq(value[0].questions).length,
            resourceId: _.get(value[0], "identifier"),
            resourceName: _.get(value[0], "name")
          });
        });
        return publishCount;
      }),
      catchError(err => {
        let errInfo = { errorMsg: "Published Resource search failed" };
        return throwError(this.cbseService.apiErrorHandling(err, errInfo));
      })
    );
  }
  public searchQuestionsByType(
    questionType: string,
    createdBy?: string,
    status?: any
  ) {
    const req = {
      url: `${this.configService.urlConFig.URLS.COMPOSITE.SEARCH}`,
      data: {
        request: {
          filters: {
            objectType: "AssessmentItem",
            board: this.selectedAttributes.board,
            framework: this.selectedAttributes.framework,
            gradeLevel: this.selectedAttributes.gradeLevel,
            subject: this.selectedAttributes.subject,
            medium: this.selectedAttributes.medium,
            programId: this.selectedAttributes.programId,
            type: questionType === "mcq" ? "mcq" : "reference",
            category:
              questionType === "curiosity"
                ? "CuriosityQuestion"
                : questionType.toUpperCase(),
            version: 3,
            status: []
          },
          limit: 0,
          facets: ["topic"]
        }
      }
    };
    if (createdBy) {
      req.data.request.filters["createdBy"] = createdBy;
    }
    if (status) {
      req.data.request.filters["status"] = status;
      req.data.request.filters[
        "organisation"
      ] = this.selectedAttributes.selectedSchoolForReview;
    }
    return this.publicDataService.post(req).pipe(
      map(res => _.get(res, "result.facets[0].values")),
      catchError(err => {
        let errInfo = { errorMsg: "Questions search by type failed" };
        return throwError(this.cbseService.apiErrorHandling(err, errInfo));
      })
    );
  }

  public openPopup(e) {
    e.stopPropagation();
    this.showResourceTemplatePopup = true;
  }

  public selectedChapterHandler(event) {
    console.log(event);
    this.showResourceTemplatePopup = event.showModal;
    this.selectedChapter = event.unitIdentifier;
  }

  handleTemplateSelection(event) {
    this.showResourceTemplatePopup = false;
    if (event.type === "submit") {
      this.templateDetails = _.find(this.configResourceList, function(o) {
        return o.contentType === event.template;
      });
      if (
        _.indexOf(
          this.templateDetails.mimeType,
          "application/vnd.ekstep.ecml-archive"
        ) < 0
      ) {
        this.showUpload = true;
      } else {
        this.showUpload = false;
      }
      // this.selectedTemplate.emit({
      //   template: this.templateDetails,
      //   selectedChapterId: this.selectedChapter
      // });
      this.openSelectedTemplate();
    }
  }

  openSelectedTemplate() {
    this.selectedComponent = this.creationComponentsList[
      this.templateDetails.contentType
    ];
    this.outputs = {
      contentDataHandler: event => {
        if (event.component === "none") {
          return delete this.selectedComponent;
        }
        this.contentData = event.contentData;
        this.selectedComponent = this.creationComponentsList[event.component];
        this.selectedComponentHeader = this.creationComponentsList[
          "ContentHeader"
        ];
        this.inputs = {
          questionMetaData: this.contentData,
          selectedAttributes: this.selectedAttributes
        };
        this.inputsHeader = {
          resourceType: "uploadContent",
          role: this.selectedAttributes.currentRole,
          questionMetaData: this.contentData,
          questionSelectionStatus: "review",
          rejectComment: "Bad syntax",
          disableSubmission: false
        };
      }
    };

    this.inputs = {
      templateDetails: this.templateDetails,
      selectedAttributes: this.selectedAttributes
    };

    this.outputsHeader = {
      buttonType: () => {},
      questionStatus: () => {}
    };
  }
  emitQuestionTypeTopic(
    type,
    topic,
    topicIdentifier,
    resourceIdentifier,
    resourceName
  ) {
    this.selectedQuestionTypeTopic.emit({
      questionType: type,
      topic: topic,
      textBookUnitIdentifier: topicIdentifier,
      resourceIdentifier: resourceIdentifier || false,
      resourceName: resourceName
    });
  }
}
