import { OpenQuestionStatus, Question, QuestionType } from "@koh/common";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { CircleCheck, Info } from "lucide-react";
import { NextRouter, useRouter } from "next/router";
import {
  default as React,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import styled from "styled-components";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import { toOrdinal } from "../../../utils/ordinal";
import { useHotkeys } from "react-hotkeys-hook";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const Container = styled.div`
  max-width: 960px;
`;

const QuestionText = styled.div`
  font-weight: normal;
  font-size: 14px;
  line-height: 22px;
  margin-bottom: 4px;
`;

const QuestionCaption = styled.div`
  font-weight: 300;
  font-size: 14px;
  line-height: 22px;
  color: #8c8c8c;
  margin-bottom: 32px;
`;

const CATEGORIES: [QuestionType, string][] = [
  [QuestionType.Concept, "Concept"],
  [QuestionType.Clarification, "Clarification"],
  [QuestionType.Testing, "Testing"],
  [QuestionType.Bug, "Bug"],
  [QuestionType.Setup, "Setup"],
  [QuestionType.Other, "Other"],
];

// The text box grows with its text from 3 to 6 lines, like antd's autoSize
const LINE_PX = 22;
const MIN_ROWS = 3;
const MAX_ROWS = 6;

interface QuestionFormProps {
  visible: boolean;
  question: Question;
  leaveQueue: () => void;
  finishQuestion: (
    text: string,
    questionType: QuestionType,
    groupable: boolean,
    router: NextRouter,
    courseId: number
  ) => void;
  position: number;
  cancel: () => void;
}

export default function QuestionForm({
  visible,
  question,
  leaveQueue,
  finishQuestion,
  position,
  cancel,
}: QuestionFormProps): ReactElement {
  const [storageQuestion, setStoredQuestion] = useLocalStorage(
    "draftQuestion",
    null
  );
  const router = useRouter();
  const courseId = router.query["cid"];

  const drafting = question?.status === OpenQuestionStatus.Drafting;
  const helping = question?.status === OpenQuestionStatus.Helping;

  // Restore an in-progress draft (persisted on every keystroke) when it
  // belongs to the question currently being edited.
  const draft =
    storageQuestion && storageQuestion.id === question?.id
      ? storageQuestion
      : null;

  const [questionTypeInput, setQuestionTypeInput] = useState<QuestionType>(
    draft?.questionType || question?.questionType || null
  );
  const [questionText, setQuestionText] = useState<string>(
    draft?.text || question?.text || ""
  );
  const [questionGroupable, setQuestionGroupable] = useState<boolean>(
    draft?.groupable ??
      (question?.groupable !== undefined && question?.groupable)
  );

  useEffect(() => {
    if (question && !visible) {
      setQuestionText(draft?.text ?? question.text);
      setQuestionTypeInput(draft?.questionType ?? question.questionType);
    }
  }, [question, visible]);

  // on question type change, update the question type state
  const onCategoryChange = (value: QuestionType) => {
    setQuestionTypeInput(value);

    const questionFromStorage = storageQuestion ?? {};

    setStoredQuestion({
      id: question?.id,
      ...questionFromStorage,
      questionType: value,
    });
  };

  // on question text change, update the question text state
  const onQuestionTextChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setQuestionText(event.target.value);

    const questionFromStorage = storageQuestion ?? {};
    setStoredQuestion({
      id: question?.id,
      ...questionFromStorage,
      text: event.target.value,
    });
  };

  // on question groupable change, update the question groupable state
  const onGroupableChange = (value: boolean) => {
    setQuestionGroupable(value);
    const questionFromStorage = storageQuestion ?? {};

    setStoredQuestion({
      id: question?.id,
      ...questionFromStorage,
      groupable: value,
    });
  };

  // on button submit click, conditionally choose to go back to the queue
  const onClickSubmit = () => {
    if (questionTypeInput && questionText && questionText !== "") {
      finishQuestion(
        questionText,
        questionTypeInput,
        questionGroupable,
        router,
        Number(courseId)
      );
    }
  };

  useHotkeys(
    "enter",
    () => {
      if (visible) onClickSubmit();
    },
    { enableOnTags: ["TEXTAREA"] },
    [
      visible,
      questionTypeInput,
      questionText,
      questionGroupable,
      router,
      courseId,
    ]
  );

  // Sized when it appears (the dialog mounts its content a render later) and
  // whenever the text changes
  const textArea = useRef<HTMLTextAreaElement | null>(null);
  const resizeTextArea = (el: HTMLTextAreaElement) => {
    const cs = getComputedStyle(el);
    const padding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const border =
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    el.style.height = "auto";
    const contentPx = el.scrollHeight - padding; // scrollHeight has no border
    const rows = Math.min(
      MAX_ROWS,
      Math.max(MIN_ROWS, Math.ceil(contentPx / LINE_PX))
    );
    el.style.height = `${rows * LINE_PX + padding + border}px`;
    el.style.overflowY = contentPx > MAX_ROWS * LINE_PX ? "auto" : "hidden";
  };
  const attachTextArea = useCallback((el: HTMLTextAreaElement | null) => {
    textArea.current = el;
    if (el) resizeTextArea(el);
  }, []);
  useLayoutEffect(() => {
    if (textArea.current) resizeTextArea(textArea.current);
  }, [questionText]);

  const closeAndKeepDraft = () => {
    setStoredQuestion(question);
    cancel();
  };

  return (
    <Dialog
      open={visible}
      onOpenChange={(open) => !open && closeAndKeepDraft()}
    >
      {/* Taller than a short screen: scroll inside, so the title stays reachable */}
      <DialogContent
        data-cy="question-form-modal"
        className="max-h-[calc(100dvh-2rem)] max-w-[520px] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            {drafting ? "Describe your question" : "Edit your question"}
          </DialogTitle>
        </DialogHeader>
        <Container>
          {drafting && (
            <Alert className="mb-8 border-[#b7eb8f] bg-[#f6ffed] [&>svg]:text-[#52c41a]">
              <CircleCheck className="size-4" />
              <AlertTitle className="text-base font-normal">
                {`You are currently ${toOrdinal(position)} in queue`}
              </AlertTitle>
              <AlertDescription>
                Your spot in queue has been temporarily reserved. Please
                describe your question to finish joining the queue.
              </AlertDescription>
            </Alert>
          )}
          {helping && (
            <Alert className="mb-8 border-[#91d5ff] bg-[#e6f7ff] [&>svg]:text-[#1890ff]">
              <Info className="size-4" />
              <AlertTitle className="text-base font-normal">
                A TA is coming to help you
              </AlertTitle>
              <AlertDescription>
                Please click &apos;Save Changes&apos; to submit what you&apos;ve
                filled out
              </AlertDescription>
            </Alert>
          )}

          <QuestionText id="question-category">
            What category does your question fall under?
          </QuestionText>
          {/* Joined buttons like antd's solid Radio.Button group. Each option is
              a <label> around its radio, so clicking the text selects it
              (Cypress: cy.get("label").contains("Concept")) */}
          <RadioGroupPrimitive.Root
            value={questionTypeInput ?? ""}
            onValueChange={(v) => onCategoryChange(v as QuestionType)}
            aria-labelledby="question-category"
            orientation="horizontal"
            className="mb-12 flex flex-wrap"
          >
            {CATEGORIES.map(([value, label]) => (
              <label
                key={value}
                data-cy={`question-type-${value}`}
                className={cn(
                  "-ml-px flex h-8 cursor-pointer select-none items-center border border-[#d9d9d9] bg-white px-[15px] text-sm text-[rgba(0,0,0,0.85)] transition-colors first:ml-0 first:rounded-l-[2px] last:rounded-r-[2px] hover:text-primary has-[:focus-visible]:relative has-[:focus-visible]:z-10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  questionTypeInput === value &&
                    "relative z-[1] border-primary bg-primary text-primary-foreground hover:text-primary-foreground"
                )}
              >
                <RadioGroupPrimitive.Item value={value} className="sr-only" />
                {label}
              </label>
            ))}
          </RadioGroupPrimitive.Root>

          <QuestionText>What do you need help with?</QuestionText>
          <Textarea
            ref={attachTextArea}
            data-cy="questionText"
            value={questionText}
            placeholder="I’m having trouble understanding list abstractions, particularly in Assignment 5."
            rows={MIN_ROWS}
            className="min-h-0 resize-none py-1 leading-[22px] md:leading-[22px]"
            onChange={onQuestionTextChange}
          />
          <QuestionCaption>
            Be as descriptive and specific as possible in your answer. Your name
            will be hidden to other students, but your question will be visible
            so don&apos;t frame your question in a way that gives away the
            answer.
          </QuestionCaption>

          <QuestionText id="question-groupable">
            Would you like the option of being helped in a group session?
          </QuestionText>
          <RadioGroup
            value={String(questionGroupable)}
            onValueChange={(v) => onGroupableChange(v === "true")}
            aria-labelledby="question-groupable"
            className="mb-[5px] flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem
                value="true"
                id="groupable-yes"
                data-cy="question-groupable-yes"
              />
              <Label htmlFor="groupable-yes" className="font-normal">
                Yes
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem
                value="false"
                id="groupable-no"
                data-cy="question-groupable-no"
              />
              <Label htmlFor="groupable-no" className="font-normal">
                No
              </Label>
            </div>
          </RadioGroup>
          <QuestionCaption>
            Clicking Yes may result in a shorter wait time if others have the
            same question as you.
          </QuestionCaption>
        </Container>
        <DialogFooter>
          {drafting ? (
            <Button
              variant="destructive"
              onClick={leaveQueue}
              data-cy="question-form-leave"
            >
              Leave Queue
            </Button>
          ) : (
            <Button variant="outline" onClick={cancel}>
              Cancel
            </Button>
          )}
          <Button
            data-cy="finishQuestion"
            disabled={
              !questionTypeInput || !questionText || questionText === ""
            }
            onClick={onClickSubmit}
          >
            {drafting ? "Finish" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
