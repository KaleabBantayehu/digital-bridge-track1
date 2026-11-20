import { Body, Controller, Get, HttpCode, Module, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { answerHelpQuestion, HELP_ENTRIES, type HelpAnswer, type HelpLang } from "@db/shared-schemas";

class AskQuestionDto {
  @ApiProperty({ example: "Do I need an ID to sign up?", description: "English or Amharic. The answer uses the same language." })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  question!: string;

  @ApiPropertyOptional({ enum: ["en", "am"], description: "Used only when the question has no letters to detect." })
  @IsOptional()
  @IsIn(["en", "am"])
  lang?: HelpLang;
}

class FaqQueryDto {
  @ApiPropertyOptional({ enum: ["en", "am"] })
  @IsOptional()
  @IsIn(["en", "am"])
  lang?: HelpLang;
}

/** Bilingual help: the same answers the <db-ask> widget gives offline. Questions are never stored or logged. */
@ApiTags("help")
@Controller("help")
class HelpController {
  @Post("ask")
  @HttpCode(200)
  @ApiOperation({ summary: "Ask a question in English or Amharic and get an answer in the same language" })
  ask(@Body() body: AskQuestionDto): HelpAnswer {
    return answerHelpQuestion(body.question, body.lang ?? "en");
  }

  @Get("faq")
  @ApiOperation({ summary: "List the common questions and answers in one language" })
  faq(@Query() query: FaqQueryDto): Array<{ id: string; question: string; answer: string }> {
    const lang = query.lang ?? "en";
    return HELP_ENTRIES.map((entry) => ({ id: entry.id, question: entry.question[lang], answer: entry.answer[lang] }));
  }
}

@Module({ controllers: [HelpController] })
export class HelpModule {}
