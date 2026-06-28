import {Body,Controller,Inject,Post} from '@nestjs/common';
import {ExtensionSourceConfigService} from '../application/extension-source-config.service';
import type {ExtensionSourceConfigInput} from '../application/extension-source-config.service';
@Controller('extension')
export class DeviceSourceSettingsController{
 constructor(@Inject(ExtensionSourceConfigService) private readonly settings:ExtensionSourceConfigService){}
 @Post('source-settings') read(@Body() body:ExtensionSourceConfigInput){return this.settings.resolve(body);}
}
