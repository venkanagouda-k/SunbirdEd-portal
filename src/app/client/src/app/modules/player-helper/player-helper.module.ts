import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SuiModule } from 'ng2-semantic-ui/dist';
import { TelemetryModule } from '@sunbird/telemetry';
import {
  ContentCreditsComponent, PlayerComponent, ContentPlayerMetadataComponent,
  CollectionTreeComponent, FancyTreeComponent, CollectionPlayerMetadataComponent,
  ContentRatingComponent
} from './components';
//import { GenericEditorComponent} from '../workspace/components/content-editors/generic-editor/generic-editor.component'
import { SharedModule } from '@sunbird/shared';
@NgModule({
  imports: [
    CommonModule,
    SuiModule,
    TelemetryModule,
    SharedModule
  ],
  declarations: [ContentCreditsComponent, PlayerComponent, ContentPlayerMetadataComponent,
    CollectionTreeComponent, FancyTreeComponent, CollectionPlayerMetadataComponent, ContentRatingComponent],
  exports: [ContentCreditsComponent, PlayerComponent, ContentPlayerMetadataComponent,
    CollectionTreeComponent, FancyTreeComponent, CollectionPlayerMetadataComponent, ContentRatingComponent]
})
export class PlayerHelperModule { }
