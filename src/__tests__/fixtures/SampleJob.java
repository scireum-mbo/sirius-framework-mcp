package sirius.biz.test;

import sirius.biz.jobs.BasicJobFactory;
import sirius.kernel.di.std.Register;

@Register(framework = "test.jobs")
public class SampleJob extends BasicJobFactory {

    @Override
    public String getName() {
        return "sample-job";
    }
}
