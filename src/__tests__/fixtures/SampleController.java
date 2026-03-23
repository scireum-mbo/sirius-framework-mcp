package sirius.biz.test;

import sirius.biz.web.BizController;
import sirius.kernel.di.std.Register;
import sirius.web.controller.Routed;
import sirius.web.security.LoginRequired;
import sirius.web.security.Permission;

@Register
public class SampleController extends BizController {

    @Routed("/things")
    @LoginRequired
    @Permission("permission-manage-things")
    public void things(WebContext webContext) {
    }

    @Routed("/thing/:1")
    @LoginRequired
    public void thing(WebContext webContext, String id) {
    }
}
