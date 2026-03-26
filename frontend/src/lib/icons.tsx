import type { ComponentType } from "react";
import {
  ApartmentOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleFilled,
  CheckOutlined,
  ClockCircleOutlined,
  CloseCircleFilled,
  CloseOutlined,
  ProductOutlined,
  DownOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EllipsisOutlined,
  HistoryOutlined,
  HolderOutlined,
  InboxOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LeftOutlined,
  LoadingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  MoonOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  RightOutlined,
  RobotOutlined,
  SearchOutlined,
  SendOutlined,
  FireOutlined,
  SunOutlined,
  SettingOutlined,
  SwapOutlined,
  BuildOutlined,
  ToolOutlined,
  UpOutlined,
  UploadOutlined,
  WarningOutlined,
  BgColorsOutlined,
  UserOutlined,
  BellOutlined,
  RadiusSettingOutlined,
  CalendarOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";

type IconProps = { className?: string };
export type LucideIcon = ComponentType<IconProps>;

export const AlertCircle = WarningOutlined;
export const AlertTriangle = WarningOutlined;
export const ArrowRightLeft = SwapOutlined;
export const Bot = RobotOutlined;
export const CheckCircle = CheckCircleFilled;
export const CheckIcon = CheckOutlined;
export const ChevronDownIcon = DownOutlined;
export const ChevronLeft = LeftOutlined;
export const ChevronLeftIcon = LeftOutlined;
export const ChevronRight = RightOutlined;
export const ChevronRightIcon = RightOutlined;
export const ChevronUpIcon = UpOutlined;
export const Clock = ClockCircleOutlined;
export const Download = DownloadOutlined;
export const Eye = EyeOutlined;
export const EyeOff = EyeInvisibleOutlined;
export const FlaskConical = BuildOutlined;
export const FolderOpen = NodeIndexOutlined;
export const GitCompare = ApartmentOutlined;
export const GripVertical = HolderOutlined;
export const History = HistoryOutlined;
export const LayoutDashboard = ProductOutlined;
export const Loader2 = LoadingOutlined;
export const MessageSquare = MessageOutlined;
export const MessageSquarePlus = MessageOutlined;
export const Moon = MoonOutlined;
export const MoreHorizontalIcon = EllipsisOutlined;
export const Pencil = EditOutlined;
export const Play = FireOutlined;
export const Plus = PlusOutlined;
export const Search = SearchOutlined;
export const SendHorizontal = SendOutlined;
export const Sun = SunOutlined;
export const Settings = SettingOutlined;
export const Trash2 = DeleteOutlined;
export const TrendingDown = ArrowDownOutlined;
export const TrendingUp = ArrowUpOutlined;
export const Upload = UploadOutlined;
export const User = UserOutlined;
export const Bell = BellOutlined;
export const RadiusSetting = RadiusSettingOutlined;
export const Calendar = CalendarOutlined;
export const Wand2 = BgColorsOutlined;
export const Wrench = ToolOutlined;
export const X = CloseOutlined;
export const XCircle = CloseCircleFilled;
export const XIcon = CloseOutlined;
export const PanelLeftClose = MenuFoldOutlined;
export const PanelLeftOpen = MenuUnfoldOutlined;
export const FailureInbox = InboxOutlined;
export const Team = TeamOutlined;
export const UserGroupAdd = UsergroupAddOutlined;
export function BenchAgentSparkle({ className }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M14 3L15.5 10.5L23 12L15.5 13.5L14 21L12.5 13.5L5 12L12.5 10.5L14 3Z" />
      <path d="M6 2L6.7 4.3L9 5L6.7 5.7L6 8L5.3 5.7L3 5L5.3 4.3L6 2Z" />
      <path d="M6 16L6.5 17.5L8 18L6.5 18.5L6 20L5.5 18.5L4 18L5.5 17.5L6 16Z" />
    </svg>
  );
}
