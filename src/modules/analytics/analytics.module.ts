import { Module } from "@nestjs/common";
import { AdminAnalyticsController, AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsReportsService } from "./analytics-reports.service";
import { GeoService } from "./geo.service";

@Module({
  controllers: [AnalyticsController, AdminAnalyticsController],
  providers: [AnalyticsService, AnalyticsReportsService, GeoService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
