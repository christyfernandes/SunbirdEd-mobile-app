import { Inject, Injectable } from '@angular/core';
import { PreferenceKey, RouterLinks } from '@app/app/app.constant';
import { GUEST_STUDENT_TABS, GUEST_TEACHER_TABS, initTabs } from '@app/app/module.service'
import { AppGlobalService } from '@app/services/app-global-service.service';
import { CommonUtilService } from '@app/services/common-util.service';
import { TelemetryGeneratorService } from '@app/services/telemetry-generator.service';
import { Events } from '@ionic/angular';
import {
  AuthService,
  ProfileService,
  ProfileType,
  SharedPreferences
} from 'sunbird-sdk';
import { Observable } from 'rxjs';
import {
  Environment,
  InteractSubtype,
  InteractType,
  PageId
} from '@app/services/telemetry-constants';
import { ContainerService } from '@app/services/container.services';
import { Router } from '@angular/router';

@Injectable()
export class LogoutHandlerService {
  constructor(
    @Inject('PROFILE_SERVICE') private profileService: ProfileService,
    @Inject('AUTH_SERVICE') private authService: AuthService,
    @Inject('SHARED_PREFERENCES') private preferences: SharedPreferences,
    private commonUtilService: CommonUtilService,
    private events: Events,
    private appGlobalService: AppGlobalService,
    private containerService: ContainerService,
    private telemetryGeneratorService: TelemetryGeneratorService,
    private router: Router
  ) { }

  public onLogout() {
    if (!this.commonUtilService.networkInfo.isNetworkAvailable) {
      return this.commonUtilService.showToast('NEED_INTERNET_TO_CHANGE');
    }

    this.generateLogoutInteractTelemetry(InteractType.TOUCH,
      InteractSubtype.LOGOUT_INITIATE, '');


    this.preferences.getString(PreferenceKey.GUEST_USER_ID_BEFORE_LOGIN)
      .do(async (guest_user_id: string) => {
        if (!guest_user_id) {
          await this.preferences.putString(PreferenceKey.SELECTED_USER_TYPE, ProfileType.TEACHER).toPromise();
        }
      })
      .mergeMap((guest_user_id: string) => this.profileService.setActiveSessionForProfile(guest_user_id))
      .mergeMap(() => Observable.defer(() => Observable.of((<any>window).splashscreen.clearPrefs())))
      .mergeMap(() => this.authService.resignSession())
      .do(async () => {
        await this.navigateToAptPage();
        this.events.publish(AppGlobalService.USER_INFO_UPDATED);
      })
      .subscribe();
  }

  private async navigateToAptPage() {
    if (this.appGlobalService.DISPLAY_ONBOARDING_PAGE) {
      // Not used page
      // Migration Todo
      // await this.app.getRootNav().setRoot(OnboardingPage);
      // this.router.navigate([])
    } else {
      const selectedUserType = await this.preferences.getString(PreferenceKey.SELECTED_USER_TYPE).toPromise();

      await this.appGlobalService.getGuestUserInfo();

      if (selectedUserType === ProfileType.STUDENT) {
        initTabs(this.containerService, GUEST_STUDENT_TABS);
      } else if (selectedUserType === ProfileType.TEACHER) {
        initTabs(this.containerService, GUEST_TEACHER_TABS);
      }

      // Migration todo
      // await this.app.getRootNav().setRoot(TabsPage, { loginMode: 'guest' });
      this.router.navigate([`/${RouterLinks.TABS}`], {
        state: {
          loginMode: 'guest'
        }
      });
    }

    this.generateLogoutInteractTelemetry(InteractType.OTHER, InteractSubtype.LOGOUT_SUCCESS, '');
  }

  private generateLogoutInteractTelemetry(interactType: InteractType, interactSubtype: InteractSubtype, uid: string) {
    const valuesMap = new Map();
    valuesMap.set('UID', uid);
    this.telemetryGeneratorService.generateInteractTelemetry(interactType,
      interactSubtype,
      Environment.HOME,
      PageId.LOGOUT,
      undefined,
      valuesMap,
      undefined,
      undefined
    );
  }
}
